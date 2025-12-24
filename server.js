import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, 'dist');

// Verificação de segurança: checa se o build existe
if (!fs.existsSync(DIST_DIR)) {
  console.error('ERRO CRÍTICO: O diretório "dist" não foi encontrado. Execute "npm run build" antes de iniciar o servidor.');
  // Em produção, isso fará o container reiniciar e tentar novamente, mas o log ajudará a identificar o erro.
}

// Serve static files from the dist directory built by Vite
app.use(express.static(DIST_DIR));

// Handle SPA routing: return index.html for any unknown route
app.get('*', (req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Erro: index.html não encontrado. A aplicação foi construída corretamente?');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Serving files from: ${DIST_DIR}`);
});