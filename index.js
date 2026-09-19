const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

// ================= CONFIGURACIÓN DE TU BOT Y SERVIDOR DISCORD =================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "eT1vynN5";

const GUILD_ID = "1545761394140651605";
const CHANNEL_ID = "1545829356310495253";
const CATEGORY_ID = null;

const historialRegistros = [];

// ================= CONFIGURACIÓN DE JSONBIN.IO (NUBE PERSISTENTE) =================
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || "PEG_AQUI_TU_BIN_ID";
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY || "PEG_AQUI_TU_MASTER_KEY";

// Funciones para leer y escribir en la nube de JSONBin
async function loadUsersFromCloud() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    const data = await res.json();
    if (data && data.record) {
      return data.record;
    }
  } catch (err) {
    console.error("Error al leer usuarios de la nube:", err);
  }
  return {
    "chispa9181": { "pass": "eT1vynN5", "status": "approved", "role": "admin" }
  };
}

async function saveUsersToCloud(users) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY
      },
      body: JSON.stringify(users)
    });
  } catch (err) {
    console.error("Error al guardar usuarios en la nube:", err);
  }
}

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
expressApp.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Faltan datos" });
  }
  
  let serverUsers = await loadUsersFromCloud();
  if (serverUsers[username]) {
    return res.status(400).json({ success: false, error: "El nombre de usuario ya existe" });
  }

  serverUsers[username] = { pass: password, status: "pending", role: "user" };
  await saveUsersToCloud(serverUsers);

  historialRegistros.unshift({
    tipoAccion: "Registro de Usuario",
    usuario: username,
    detalles: "Nueva cuenta solicitada (Pendiente de aprobación)",
    fecha: new Date().toLocaleString("es-ES")
  });

  res.json({ success: true });
});

// ================= ENDPOINT: LOGIN DE USUARIOS =================
expressApp.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  let serverUsers = await loadUsersFromCloud();
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
expressApp.post('/api/users', async (req, res) => {
  const { password, action, targetUser } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: "No autorizado" });
  }

  let serverUsers = await loadUsersFromCloud();

  if (action === "approve" && serverUsers[targetUser]) {
    serverUsers[targetUser].status = "approved";
    await saveUsersToCloud(serverUsers);
  } else if (action === "reject" && targetUser && targetUser !== "chispa9181") {
    delete serverUsers[targetUser];
    await saveUsersToCloud(serverUsers);
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
      detalles: `Tipo: ${tipo || 'Normal'} | Ganancias: ${ganancias}€ \vert{} Brawlers:${brawlers || 'Ninguno'}`,
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
      detalles: `Trabajo: ${trabajo} \vert{} Info:${detalles || 'Sin detalles adicionales'}`,
      fecha: new Date().toLocaleString("es-ES")
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al registrar finalización de trabajo" });
  }
});

// ================= ENDPOINT: ENVIAR DUDAS =================
expressApp.post('/api/duda', async (req, res) => {
  try {
    const { usuario, titulo, mensaje } = req.body;
    const webhookUrl = "https://discord.com/api/webhooks/1545843817176109116/J6TU-V1-XiCdpFrRa-Usmx-FPokgHlEtUq1c2GQESG82pRbsoCqVJXCLXsHGh9gYNfp2";

    historialRegistros.unshift({
      tipoAccion: "Envío de Duda",
      usuario: usuario || "Anónimo",
      detalles: `Asunto: ${titulo}`,
      fecha: new Date().toLocaleString("es-ES")
    });

    const payload = {
      username: "BrawlPush Bot",
      avatar_url: "https://i.imgur.com/4M34hi2.png",
      embeds: [{
        title: "💬 **NUEVA CONSULTA / DUDA**",
        color: 3447003,
        fields: [
          { name: "👤 **Miembro del Staff**", value: `\`${usuario || "Anónimo"}\``, inline: true },
          { name: "📌 **Asunto**", value: `**${titulo}**`, inline: false },
          { name: "📝 **Mensaje / Consulta**", value: `> ${mensaje}`, inline: false }
        ],
        footer: {
          text: "BrawlPush Soporte Interno",
          icon_url: "https://i.imgur.com/4M34hi2.png"
        },
        timestamp: new Date().toISOString()
      }]
    };

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (discordRes.ok) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: "Error al conectar con Discord" });
    }
  } catch (error) {
    console.error("Error al procesar la duda:", error);
    res.status(500).json({ success: false, error: error.message });
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
