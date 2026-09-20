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

let serverUsers = loadUsers();

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
  const { password, action, targetUser, newRole } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: "No autorizado" });
  }

  let serverUsers = loadUsers();

  if (action === "approve" && serverUsers[targetUser]) {
    serverUsers[targetUser].status = "approved";
    saveUsersToFile(serverUsers);
  } else if (action === "role" && serverUsers[targetUser] && targetUser !== "chispa9181") {
    serverUsers[targetUser].role = newRole; // "user" (staff) o "admin"
    saveUsersToFile(serverUsers);
  } else if (action === "reject" && targetUser && targetUser !== "chispa9181") {
    delete serverUsers[targetUser];
    saveUsersToFile(serverUsers);
  }

  res.json({ success: true, users: serverUsers });
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

// ================= ENDPOINT: FINALIZACIÓN DE TRABAJOS =================
expressApp.post('/api/finalizar-trabajo', async (req, res) => {
  try {
    const { usuario, trabajo, detalles } = req.body;

    historialRegistros.unshift({
      tipoAccion: "Finalización de Trabajo",
      usuario: usuario || "Anónimo",
      detalles: `Trabajo: ${trabajo} | Info: ${detalles || 'Sin detalles adicionales'}`,
      fecha: new Date().toLocaleString("es-ES")
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al registrar finalización de trabajo" });
  }
});

// ================= ENDPOINT: OBTENER REGISTROS PARA MODO ADMIN =================
expressApp.post('/api/registros', (req, res) => {
  const { password } = req.body;

  if (password && password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
  }

  res.json({ success: true, registros: historialRegistros });
});

// ================= INTERACCIONES: BOTONES DISCORD =================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'claim_order_btn') {
    const guild = interaction.guild;
    const user = interaction.user;
    const originalEmbed = interaction.message.embeds[0];

    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(5763719)
      .setFields(
        { name: "👤 Creado por", value: originalEmbed.fields[0].value, inline: true },
        { name: "💰 Ganancias", value: originalEmbed.fields[1].value, inline: true },
        { name: "📦 Tipo de orden", value: originalEmbed.fields[2].value, inline: true },
        { name: "⚡ Brawlers a Fuerza 11", value: originalEmbed.fields[3].value },
        { name: "📝 Detalles de la orden", value: originalEmbed.fields[4].value },
        { name: "✅ Atendido por", value: `<@${user.id}> (${user.username})` }
      );

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('claimed_done')
        .setLabel('Reclamado')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await interaction.message.edit({ embeds: [updatedEmbed], components: [disabledRow] });

    const ticketChannel = await guild.channels.create({
      name: `orden-${user.username}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID || null,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
      ]
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle("🎟️ Ticket de Orden Iniciado")
      .setDescription(`¡Hola <@${user.id}>! Un administrador te atenderá lo antes posible.`)
      .setColor(3840952)
      .setFooter({ text: "Sistema de Soporte de Órdenes" })
      .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket_btn')
        .setLabel('🔒 Cerrar Ticket')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ content: `<@${user.id}>`, embeds: [ticketEmbed], components: [closeRow] });
    await interaction.reply({ content: `¡Orden reclamada con éxito! Ve al canal <#${ticketChannel.id}>`, ephemeral: true });
  }

  if (interaction.customId === 'close_ticket_btn') {
    await interaction.reply({ content: '🔒 Este ticket se cerrará en **5 segundos**...' });
    setTimeout(async () => {
      try {
        await interaction.channel.delete();
      } catch (err) {}
    }, 5000);
  }
});

client.login(BOT_TOKEN);

expressApp.listen(3000, () => {
  console.log('🤖 Servidor del Bot encendido y listo en el puerto 3000');
});
