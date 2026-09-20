const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

// ================= CONFIGURACIÓN DE TU BOT Y SERVIDOR DISCORD =================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "eT1vynN5";

const GUILD_ID = "1545761394140651605";
const CHANNEL_ID = "1545829356310495253";
const CATEGORY_ID = null;

const historialRegistros = [];
const USERS_FILE = './users.json';
const CHATS_FILE = './chats.json';

// Cargar usuarios de forma segura y persistente
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
  } catch (err) {
    console.error("Error al leer users.json:", err);
  }
  
  const defaultUsers = {
    "chispa9181": { pass: "eT1vynN5", status: "approved", role: "admin" }
  };
  saveUsersToFile(defaultUsers);
  return defaultUsers;
}

function saveUsersToFile(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error("Error al guardar users.json:", err);
  }
}

// Cargar chats de forma persistente
function loadChats() {
  try {
    if (fs.existsSync(CHATS_FILE)) {
      const data = fs.readFileSync(CHATS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error al leer chats.json:", err);
  }
  return {};
}

function saveChatsToFile(chats) {
  try {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2), 'utf8');
  } catch (err) {
    console.error("Error al guardar chats.json:", err);
  }
}

let serverUsers = loadUsers();
let serverChats = loadChats();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

// ================= ENDPOINT: REGISTRO DE USUARIOS =================
expressApp.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Faltan datos" });
  }
  
  serverUsers = loadUsers();
  if (serverUsers[username]) {
    return res.status(400).json({ success: false, error: "El nombre de usuario ya existe" });
  }

  serverUsers[username] = { pass: password, status: "pending", role: "user" };
  saveUsersToFile(serverUsers);

  historialRegistros.unshift({
    tipoAccion: "Registro de Usuario",
    usuario: username,
    detalles: "Nueva cuenta solicitada (Pendiente de aprobación)",
    fecha: new Date().toLocaleString("es-ES")
  });

  res.json({ success: true });
});

// ================= ENDPOINT: LOGIN DE USUARIOS =================
expressApp.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  serverUsers = loadUsers();
  const user = serverUsers[username];

  if (!user || user.pass !== password) {
    return res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos" });
  }
  if (user.status !== "approved") {
    return res.status(403).json({ success: false, error: "Tu cuenta está pendiente de aprobación por el admin." });
  }

  res.json({ success: true, role: user.role });
});

// ================= ENDPOINT: GESTIÓN DE USUARIOS (ADMIN) =================
expressApp.post('/api/users', (req, res) => {
  const { password, action, targetUser, newRole, newPassword } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: "No autorizado" });
  }

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

// ================= ENDPOINT: OBTENER MENSAJES DE CHAT =================
expressApp.post('/api/chat/get', (req, res) => {
  const { username, isAdmin } = req.body;
  serverChats = loadChats();

  if (isAdmin) {
    // El admin recibe todos los chats disponibles
    res.json({ success: true, chats: serverChats });
  } else {
    // El usuario normal solo recibe su propio chat con el admin
    const userChat = serverChats[username] || [];
    res.json({ success: true, messages: userChat });
  }
});

// ================= ENDPOINT: ENVIAR MENSAJE DE CHAT =================
expressApp.post('/api/chat/send', (req, res) => {
  const { sender, recipient, message, isAdmin } = req.body;
  if (!sender || !message) {
    return res.status(400).json({ success: false, error: "Faltan datos" });
  }

  serverChats = loadChats();
  // Definimos la clave del chat según quién hable con quién
  const chatKey = isAdmin ? recipient : sender;

  if (!serverChats[chatKey]) {
    serverChats[chatKey] = [];
  }

  serverChats[chatKey].push({
    sender,
    message,
    time: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
  });

  saveChatsToFile(serverChats);
  res.json({ success: true, chats: serverChats });
});

// ================= ENDPOINT: CREAR ÓRDENES =================
expressApp.post('/api/ticket', async (req, res) => {
  try {
    const { creadoPor, ganancias, tipo, brawlers, detalles } = req.body;

    historialRegistros.unshift({
      tipoAccion: "Creación de Orden",
      usuario: creadoPor || "Anónimo",
      detalles: `Tipo: ${tipo || 'Normal'} | Ganancias: ${ganancias}€ | Brawlers: ${brawlers || 'Ninguno'}`,
      fecha: new Date().toLocaleString("es-ES")
    });

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
      new ButtonBuilder()
        .setCustomId('claim_order_btn')
        .setLabel('📩 Reclamar Orden')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
    res.json({ success: true });
  } catch (err) {
    console.error("Error al procesar la orden:", err);
    res.status(500).json({ error: "Error al enviar la orden a Discord" });
  }
});

expressApp.listen(3000, () => {
  console.log('🤖 Servidor del Bot encendido y listo en el puerto 3000');
});
