const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

// ==========================================
// CONFIGURACIÓN DE TU BOT Y SERVIDOR DISCORD
// ==========================================
const BOT_TOKEN = "MTU1MDkyMDA0Njk3MTE5NTUxMg.G3J_cD.M7jZ5TQ9sOmgNcD2LA5zE2UQN9DldW2CUlOLb4";
const GUILD_ID = "1545761394140651605";
const CHANNEL_ID = "1545829356310495253";
const CATEGORY_ID = null;

// Arreglo en memoria para guardar el historial de registros
const historialRegistros = [];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// ENDPOINT: CREAR ÓRDENES
// ==========================================
app.post('/api/ticket', async (req, res) => {
  try {
    const { creadoPor, ganancias, tipo, brawlers, detalles } = req.body;

    // Guardar en el historial de registros
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

// ==========================================
// ENDPOINT: FINALIZACIÓN DE TRABAJOS
// ==========================================
app.post('/api/finalizar-trabajo', async (req, res) => {
  try {
    const { usuario, trabajo, detalles } = req.body;

    // Guardar en el historial de registros
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

// ==========================================
// ENDPOINT: OBTENER REGISTROS PARA MODO ADMIN
// ==========================================
app.get('/api/registros', (req, res) => {
  res.json({ registros: historialRegistros });
});

// ==========================================
// INTERACCIONES: BOTONES DISCORD
// ==========================================
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
      .setTitle(`🎟️ Ticket de Orden Iniciado`)
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

    await ticketChannel.send({ content: `👋 <@${user.id}>`, embeds: [ticketEmbed], components: [closeRow] });
    await interaction.reply({ content: `¡Orden reclamada con éxito! Ve al canal <#${ticketChannel.id}>`, ephemeral: true });
  }

  if (interaction.customId === 'close_ticket_btn') {
    await interaction.reply({ content: '🔒 Este ticket se cerrará en **5 segundos**...' });
    setTimeout(async () => {
      try { await interaction.channel.delete(); } catch (err) {}
    }, 5000);
  }
});

client.login(BOT_TOKEN);

app.listen(3000, () => {
  console.log('🤖 Servidor del Bot encendido y listo en http://localhost:3000');
});