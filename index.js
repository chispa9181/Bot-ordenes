const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "eT1vynN5";

const GUILD_ID = "1545761394140651605";
const CHANNEL_ID = "1545829356310495253";

const USERS_FILE = './users.json';
const CHATS_FILE = './chats.json';

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (!parsed["chispa9181"]) {
        parsed["chispa9181"] = { pass: "eT1vynN5", status: "approved", role: "admin" };
      }
      return parsed;
    }
  } catch (err) {}
  
  const defaultUsers = { "chispa9181": { pass: "eT1vynN5", status: "approved", role: "admin" } };
  "aiden": { pass: "Esguapo28", status: "approved", role: "admin" }
  saveUsersToFile(defaultUsers);
  return defaultUsers;
}

function saveUsersToFile(users) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8'); } catch (err) {}
}

function loadChats() {
  try {
    if (fs.existsSync(CHATS_FILE)) {
      const data = fs.readFileSync(CHATS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {}
  return {};
}

function saveChatsToFile(chats) {
  try { fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2), 'utf8'); } catch (err) {}
}

let serverUsers = loadUsers();
let serverChats = loadChats();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers] });
const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

expressApp.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: "Faltan datos" });
  serverUsers = loadUsers();
  if (serverUsers[username]) return res.status(400).json({ success: false, error: "El usuario ya existe" });

  serverUsers[username] = { pass: password, status: "pending", role: "user" };
  saveUsersToFile(serverUsers);
  res.json({ success: true });
});

expressApp.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  serverUsers = loadUsers();
  const user = serverUsers[username];
  if (!user || user.pass !== password) return res.status(401).json({ success: false, error: "Datos incorrectos" });
  if (user.status !== "approved") return res.status(403).json({ success: false, error: "Cuenta pendiente de aprobación." });
  res.json({ success: true, role: user.role });
});

expressApp.post('/api/users', (req, res) => {
  const { password, action, targetUser, newRole, newPassword } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ success: false, error: "No autorizado" });
  let serverUsers = loadUsers();

  if (action === "approve" && serverUsers[targetUser]) {
    serverUsers[targetUser].status = "approved";
    saveUsersToFile(serverUsers);
  } else if (action === "role" && serverUsers[targetUser] && targetUser !== "chispa9181") {
    serverUsers[targetUser].role = newRole;
    saveUsersToFile(serverUsers);
  } else if (action === "password" && serverUsers[targetUser] && targetUser !== "chispa9181") {
    serverUsers[targetUser].pass = newPassword;
    saveUsersToFile(serverUsers);
  } else if (action === "reject" && targetUser && targetUser !== "chispa9181") {
    delete serverUsers[targetUser];
    saveUsersToFile(serverUsers);
  }
  res.json({ success: true, users: serverUsers });
});

expressApp.post('/api/chat/get', (req, res) => {
  const { username, isAdmin } = req.body;
  serverChats = loadChats();
  if (isAdmin) {
    res.json({ success: true, chats: serverChats });
  } else {
    res.json({ success: true, messages: serverChats[username] || [] });
  }
});

expressApp.post('/api/chat/send', (req, res) => {
  const { sender, recipient, message, isAdmin } = req.body;
  if (!sender || !message) return res.status(400).json({ success: false });

  serverChats = loadChats();
  const chatKey = isAdmin ? recipient : sender;
  if (!serverChats[chatKey]) serverChats[chatKey] = [];

  serverChats[chatKey].push({
    sender,
    message,
    time: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
  });

  saveChatsToFile(serverChats);
  res.json({ success: true, chats: serverChats });
});

// Endpoint para eliminar un chat completo (Admin)
expressApp.post('/api/chat/delete', (req, res) => {
  const { password, targetUser } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ success: false, error: "No autorizado" });

  serverChats = loadChats();
  if (serverChats[targetUser]) {
    delete serverChats[targetUser];
    saveChatsToFile(serverChats);
  }
  res.json({ success: true, chats: serverChats });
});

expressApp.post('/api/ticket', async (req, res) => {
  try {
    const { creadoPor, ganancias, tipo, brawlers, detalles } = req.body;
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle(`🛠️ Nueva Orden Creada`)
      .setColor(3840952)
      .addFields(
        { name: "👤 Creado por", value: creadoPor || "Anónimo", inline: true },
        { name: "💰 Ganancias", value: `${ganancias}€`, inline: true },
        { name: "📦 Tipo de orden", value: tipo || "Normal", inline: true },
        { name: "⚡ Brawlers a Fuerza 11", value: brawlers || "Ninguno" },
        { name: "📝 Detalles de la orden", value: detalles || "Sin detalles" },
        { name: "📌 Estado", value: "🔴 Pendiente de reclamar" }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_order_btn').setLabel('📩 Reclamar Orden').setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al enviar la orden" });
  }
});

client.login(BOT_TOKEN);
expressApp.listen(3000, () => { console.log('Servidor listo en puerto 3000'); });
