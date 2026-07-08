/**
 * Script de seed: cadastra 30 equipamentos de demonstração no Supabase
 * Distribui entre os 4 usuários, 70% aluguel / 30% venda
 * Faz upload das imagens WebP para o Storage
 *
 * Uso: node equipamentos/seed.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Supabase config ---
const SUPABASE_URL = 'https://wyropieferycysdohzos.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_KEY como variável de ambiente.');
  console.error('   Pegue em: Supabase → Settings → API → service_role (secret)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// --- Parse CSV ---
const csvPath = join(__dirname, 'lista_equipamentos_cinesafe.csv');
const csvRaw = readFileSync(csvPath, 'utf-8');
const lines = csvRaw.split('\n').filter(l => l.trim().length > 0);
const headers = lines[0].split(';').map(h => h.trim().replace(/\r/g, ''));
const rows = lines.slice(1).map(line => {
  const cols = line.split(';').map(c => c.trim().replace(/\r/g, ''));
  return Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
});

console.log(`📋 ${rows.length} equipamentos encontrados no CSV`);

// --- Get users ---
const { data: users, error: usersErr } = await supabase.from('users').select('id, name, avatar_url, location');
if (usersErr || !users || users.length === 0) {
  console.error('❌ Erro ao buscar usuários:', usersErr);
  process.exit(1);
}
console.log(`👥 ${users.length} usuários encontrados: ${users.map(u => u.name).join(', ')}`);

// --- Upload images and insert equipment ---
let success = 0;
let errors = 0;

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const idx = i + 1;
  const paddedIdx = String(idx).padStart(2, '0');

  // Distribute users round-robin
  const user = users[i % users.length];

  // Find matching image file (.webp)
  const imgFile = readdirSync(__dirname).find(f => f.startsWith(paddedIdx + '_') && f.endsWith('.webp'));
  if (!imgFile) {
    console.error(`⚠️  Imagem não encontrada para item ${idx}`);
    errors++;
    continue;
  }

  const imgBytes = readFileSync(join(__dirname, imgFile));
  const storagePath = `${user.id}/equipment/${crypto.randomUUID()}.webp`;

  // Upload image to Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from('equipment')
    .upload(storagePath, imgBytes, { contentType: 'image/webp', upsert: true });

  if (uploadErr) {
    console.error(`❌ Upload falhou para ${imgFile}:`, uploadErr.message);
    errors++;
    continue;
  }

  const { data: publicUrl } = supabase.storage.from('equipment').getPublicUrl(storagePath);
  const imageUrl = publicUrl.publicUrl;

  // Determine rent vs sale
  const isForRent = row['Disponível para Aluguel'] === 'Sim';
  const isForSale = row['Disponível para Venda'] === 'Sim';
  const rentalPrice = isForRent && row['Valor da Diária (R$)'] ? Number(row['Valor da Diária (R$)']) : null;
  const salePrice = isForSale && row['Valor de Venda (R$)'] ? Number(row['Valor de Venda (R$)']) : null;
  const category = row['Categoria'] === 'Lente' ? 'Lente' : 'Câmera';

  const equipId = crypto.randomUUID();
  const dbRow = {
    id: equipId,
    owner_id: user.id,
    name: `${row['Marca']} ${row['Modelo']}`,
    brand: row['Marca'],
    model: row['Modelo'],
    serial_number: row['Nº de Série'].trim().toUpperCase(),
    category: category,
    status: 'SAFE',
    value: Number(row['Valor Estimado (R$)']) || 0,
    is_for_rent: isForRent,
    rental_price_per_day: rentalPrice,
    is_for_sale: isForSale,
    sale_price: salePrice,
    image_url: imageUrl,
    description: row['Descrição'],
    purchase_date: new Date().toISOString().split('T')[0],
    owner_profile: {
      name: user.name,
      avatarUrl: user.avatar_url,
      location: user.location || 'Brasil'
    }
  };

  const { error: insertErr } = await supabase.from('equipment').insert(dbRow);
  if (insertErr) {
    console.error(`❌ Insert falhou para ${row['Marca']} ${row['Modelo']}:`, insertErr.message);
    errors++;
    continue;
  }

  const marker = isForRent ? '🏷️ Aluguel' : '💰 Venda';
  console.log(`✅ [${idx}/${rows.length}] ${row['Marca']} ${row['Modelo']} → ${user.name} ${marker}`);
  success++;
}

// Update inventory counts
for (const user of users) {
  const { count } = await supabase
    .from('equipment')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user.id);
  await supabase.from('users').update({ inventory_count: count || 0 }).eq('id', user.id);
}

console.log(`\n🏁 Concluído! ${success} cadastrados, ${errors} erros.`);
