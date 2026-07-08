-- =====================================================
-- CineSafe — Schema PostgreSQL (Supabase)
-- Migração do Firestore para PostgreSQL relacional
-- =====================================================

-- ============= TABELAS =============

-- Users (perfil público, estende auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  reputation_points INT NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  contact_phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  checks_count INT DEFAULT 0,
  reports_count INT DEFAULT 0,
  inventory_count INT DEFAULT 0,
  connections TEXT[] DEFAULT '{}',
  transaction_history JSONB DEFAULT '{}',
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  referral_count INT DEFAULT 0,
  usage_stats JSONB DEFAULT '{"serialChecks":{"count":0,"month":""},"contactReveals":{"count":0,"month":""}}',
  notification_stats JSONB DEFAULT '{"rentalInterest":0,"saleInterest":0,"stolenAlerts":0}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment (inventário + marketplace)
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Câmera',
  status TEXT NOT NULL DEFAULT 'SAFE' CHECK (status IN ('SAFE','STOLEN','LOST','TRANSFER_PENDING')),
  value NUMERIC,
  is_for_rent BOOLEAN DEFAULT false,
  rental_price_per_day NUMERIC,
  is_for_sale BOOLEAN DEFAULT false,
  sale_price NUMERIC,
  image_url TEXT,
  invoice_url TEXT,
  description TEXT,
  purchase_date TEXT,
  theft_location JSONB,
  theft_date TEXT,
  theft_address TEXT,
  pending_transfer_to UUID,
  owner_profile JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  from_user_name TEXT NOT NULL DEFAULT '',
  from_user_phone TEXT,
  from_user_avatar TEXT,
  from_user_reputation INT,
  from_user_connections_count INT,
  item_id TEXT,
  item_name TEXT,
  item_image TEXT,
  type TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  message TEXT,
  expires_at TIMESTAMPTZ,
  action_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Theft History (imutável)
CREATE TABLE public.theft_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  equipment_name TEXT,
  equipment_value NUMERIC,
  theft_location JSONB,
  theft_address TEXT,
  theft_date TEXT,
  recovered_via_app BOOLEAN DEFAULT false,
  recovery_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ads (banners de marketing)
CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name TEXT NOT NULL DEFAULT '',
  tagline TEXT,
  title TEXT NOT NULL,
  price_old TEXT,
  price_new TEXT,
  button_text TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  weight INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0
);

-- Chats (metadados da conversa)
CREATE TABLE public.chats (
  id TEXT PRIMARY KEY,  -- determinístico: [a,b].sort().join('__')
  participants TEXT[] NOT NULL,
  participant_info JSONB DEFAULT '{}',
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts (aluguel/venda)
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('rental', 'sale')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','active','completed','declined','cancelled')),
  parties TEXT[] NOT NULL,
  owner_id UUID NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  owner_avatar TEXT,
  counterparty_id UUID NOT NULL,
  counterparty_name TEXT NOT NULL DEFAULT '',
  counterparty_avatar TEXT,
  equipment_id UUID,
  equipment_name TEXT,
  equipment_image TEXT,
  value NUMERIC NOT NULL DEFAULT 0,
  pickup_date TEXT,
  return_date TEXT,
  chat_id TEXT,
  payment_status TEXT CHECK (payment_status IN ('submitted', 'confirmed')),
  payment_proof_url TEXT,
  payment_submitted_by TEXT,
  payment_at TEXT,
  overdue_notice_at TEXT,
  public_alert BOOLEAN DEFAULT false,
  public_alert_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Return Alerts (alertas públicos de não-devolução)
CREATE TABLE public.return_alerts (
  id TEXT PRIMARY KEY,  -- = contractId
  contract_id TEXT NOT NULL,
  renter_id UUID NOT NULL,
  renter_name TEXT NOT NULL DEFAULT '',
  renter_avatar TEXT,
  owner_id UUID NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  equipment_name TEXT,
  equipment_image TEXT,
  agreed_return_date TEXT,
  raised_at TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  resolved_at TEXT
);

-- Global Stats (documento único)
CREATE TABLE public.global_stats (
  id TEXT PRIMARY KEY DEFAULT 'global',
  total_items INT DEFAULT 0,
  safe_items_count INT DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  stolen_items INT DEFAULT 0,
  recovered_items INT DEFAULT 0,
  recovered_value NUMERIC DEFAULT 0,
  rental_offers INT DEFAULT 0,
  sale_offers INT DEFAULT 0,
  items_for_rent_count INT DEFAULT 0,
  items_for_sale_count INT DEFAULT 0,
  transactions_count INT DEFAULT 0,
  transacted_value NUMERIC DEFAULT 0
);

-- Raffles (sorteios)
CREATE TABLE public.raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  prize_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','cancelled')),
  created_by UUID NOT NULL REFERENCES public.users(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  winner_id UUID,
  winner_name TEXT,
  winner_avatar TEXT,
  drawn_at TEXT,
  total_tickets INT DEFAULT 0,
  total_participants INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raffle Tickets
CREATE TABLE public.raffle_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  user_avatar TEXT DEFAULT '',
  source TEXT NOT NULL CHECK (source IN ('signup', 'referral')),
  referred_user_id UUID,
  referred_user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============= ÍNDICES =============

CREATE INDEX idx_equipment_owner ON public.equipment(owner_id);
CREATE INDEX idx_equipment_status ON public.equipment(status);
CREATE INDEX idx_equipment_serial ON public.equipment(UPPER(serial_number));
CREATE INDEX idx_notifications_to ON public.notifications(to_user_id);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX idx_contracts_parties ON public.contracts USING GIN(parties);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_chat_messages_chat ON public.chat_messages(chat_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);
CREATE INDEX idx_raffle_tickets_raffle ON public.raffle_tickets(raffle_id);
CREATE INDEX idx_raffle_tickets_user ON public.raffle_tickets(user_id);
CREATE INDEX idx_raffles_status ON public.raffles(status);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);

-- ============= ROW LEVEL SECURITY =============

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_auth" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "users_delete_admin" ON public.users FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Equipment
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
-- Vitrine pública: itens SAFE anunciados
CREATE POLICY "equipment_select_public" ON public.equipment FOR SELECT USING (
  (status = 'SAFE' AND (is_for_rent = true OR is_for_sale = true))
  OR auth.role() = 'authenticated'
);
CREATE POLICY "equipment_insert_own" ON public.equipment FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "equipment_update_own" ON public.equipment FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "equipment_update_admin" ON public.equipment FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "equipment_delete_own" ON public.equipment FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "equipment_delete_admin" ON public.equipment FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = to_user_id);
CREATE POLICY "notifications_insert_auth" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = to_user_id);
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE USING (auth.uid() = to_user_id);

-- Theft History
ALTER TABLE public.theft_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "theft_history_select_auth" ON public.theft_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "theft_history_insert_auth" ON public.theft_history FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Ads
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_select_all" ON public.ads FOR SELECT USING (true);
CREATE POLICY "ads_insert_admin" ON public.ads FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "ads_update_admin" ON public.ads FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "ads_delete_admin" ON public.ads FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Chats
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chats_select_participant" ON public.chats FOR SELECT USING (
  auth.uid()::text = ANY(participants)
);
CREATE POLICY "chats_insert_participant" ON public.chats FOR INSERT WITH CHECK (
  auth.uid()::text = ANY(participants)
);
CREATE POLICY "chats_update_participant" ON public.chats FOR UPDATE USING (
  auth.uid()::text = ANY(participants)
);

-- Chat Messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_participant" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chats WHERE id = chat_id AND auth.uid()::text = ANY(participants))
);
CREATE POLICY "messages_insert_sender" ON public.chat_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);

-- Contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_select_party" ON public.contracts FOR SELECT USING (
  auth.uid()::text = ANY(parties)
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "contracts_insert_owner" ON public.contracts FOR INSERT WITH CHECK (
  auth.uid()::text = ANY(parties)
);
CREATE POLICY "contracts_update_party" ON public.contracts FOR UPDATE USING (
  auth.uid()::text = ANY(parties)
);

-- Return Alerts
ALTER TABLE public.return_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_alerts_select_all" ON public.return_alerts FOR SELECT USING (true);
CREATE POLICY "return_alerts_insert_owner" ON public.return_alerts FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "return_alerts_update_owner" ON public.return_alerts FOR UPDATE USING (auth.uid() = owner_id);

-- Global Stats
ALTER TABLE public.global_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats_select_auth" ON public.global_stats FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "stats_update_auth" ON public.global_stats FOR UPDATE USING (auth.role() = 'authenticated');

-- Raffles
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffles_select_auth" ON public.raffles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "raffles_insert_admin" ON public.raffles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "raffles_update_admin" ON public.raffles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "raffles_delete_admin" ON public.raffles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Raffle Tickets
ALTER TABLE public.raffle_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffle_tickets_select_auth" ON public.raffle_tickets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "raffle_tickets_insert_own" ON public.raffle_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "raffle_tickets_update_admin" ON public.raffle_tickets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "raffle_tickets_delete_admin" ON public.raffle_tickets FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ============= STORAGE BUCKETS =============

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('equipment', 'equipment', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('ads', 'ads', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('raffles', 'raffles', true);

-- Storage Policies
-- Equipment: leitura pública, escrita pelo dono
CREATE POLICY "equipment_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'equipment');
CREATE POLICY "equipment_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'equipment' AND auth.role() = 'authenticated');
CREATE POLICY "equipment_storage_delete" ON storage.objects FOR DELETE USING (bucket_id = 'equipment' AND auth.role() = 'authenticated');

-- Avatars: leitura autenticada, escrita própria
CREATE POLICY "avatars_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "avatars_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Ads: leitura pública, escrita admin
CREATE POLICY "ads_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'ads');
CREATE POLICY "ads_storage_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'ads' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Contracts: leitura autenticada, escrita autenticada
CREATE POLICY "contracts_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'contracts' AND auth.role() = 'authenticated');
CREATE POLICY "contracts_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'contracts' AND auth.role() = 'authenticated');

-- Invoices: leitura autenticada, escrita autenticada
CREATE POLICY "invoices_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'invoices' AND auth.role() = 'authenticated');
CREATE POLICY "invoices_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'invoices' AND auth.role() = 'authenticated');

-- Raffles: leitura pública, escrita admin
CREATE POLICY "raffles_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'raffles');
CREATE POLICY "raffles_storage_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'raffles' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ============= DADOS INICIAIS =============

INSERT INTO public.global_stats (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
