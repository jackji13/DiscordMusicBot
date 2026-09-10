require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { MusicPlayer } = require('./musicPlayer');

// Create a new client instance
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

// Create music player instance
const musicPlayer = new MusicPlayer();

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Listen for messages
client.on(Events.MessageCreate, async message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    // Simple ping command
    if (command === '!ping') {
        message.reply('🏓 Pong！机器人在线！');
    }

    // Hello command
    if (command === '!hello') {
        message.reply(`你好 ${message.author.username}！👋`);
    }

    // Join voice channel command
    if (command === '!join') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ 你需要先加入一个语音频道！');
        }

        try {
            await musicPlayer.joinChannel(
                { guildId: message.guild.id, guild: message.guild }, 
                voiceChannel
            );
            message.reply(`✅ 已加入 ${voiceChannel.name}！`);
        } catch (error) {
            console.error(error);
            message.reply('❌ 加入语音频道失败！');
        }
    }

    // Play music command
    if (command === '!play') {
        const url = args[1];
        if (!url) {
            // No URL → try to resume paused playback
            if (!musicPlayer.connections.has(message.guild.id)) {
                return message.reply('❌ 我当前没有连接到语音频道！');
            }
            const resumed = musicPlayer.resume(message.guild.id);
            if (resumed) {
                return message.reply('▶️ 已继续播放！');
            }
            return message.reply('❌ 当前没有已暂停的播放。\n请提供一个链接来播放，例如：`!play https://www.youtube.com/watch?v=...`');
        }

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ 你需要先加入语音频道才能播放音乐！');
        }

        const loadingMsg = await message.reply('🔄 正在加载音频...');

        try {
            // Join voice channel if not already connected
            if (!musicPlayer.connections.has(message.guild.id)) {
                await musicPlayer.joinChannel(
                    { guildId: message.guild.id, guild: message.guild }, 
                    voiceChannel
                );
            }

            // Check if something is currently playing
            const isCurrentlyPlaying = musicPlayer.isPlaying(message.guild.id);
            
            if (isCurrentlyPlaying) {
                // Add to queue if something is playing
                const songInfo = await musicPlayer.addUrlToQueue(
                    { guildId: message.guild.id, editReply: (msg) => loadingMsg.edit(msg) }, 
                    url
                );

                if (songInfo) {
                    const currentVolume = musicPlayer.getVolumePercentage(message.guild.id);
                    const currentQueue = musicPlayer.getQueue(message.guild.id);
                    const queueLength = currentQueue.length;
                    
                    loadingMsg.edit(`➕ 已加入队列：**${songInfo.title}**\n🔊 音量：**${currentVolume}%**\n📜 队列：**${queueLength} 首**`);
                }
            } else {
                // Play immediately if nothing is playing
                const songInfo = await musicPlayer.playUrl(
                    { guildId: message.guild.id, editReply: (msg) => loadingMsg.edit(msg) }, 
                    url
                );

                if (songInfo) {
                    const currentVolume = musicPlayer.getVolumePercentage(message.guild.id);
                    const currentQueue = musicPlayer.getQueue(message.guild.id);
                    const queueLength = currentQueue.length;
                    
                    loadingMsg.edit(`🎵 正在播放：**${songInfo.title}**\n🔊 音量：**${currentVolume}%**\n📜 队列：**${queueLength} 首**`);
                }
            }
        } catch (error) {
            console.error(error);
            loadingMsg.edit('❌ 播放音频失败，请确认链接有效且可访问！');
        }
    }

    // Pause music command
    if (command === '!pause') {
        if (!musicPlayer.connections.has(message.guild.id)) {
            return message.reply('❌ 我当前没有连接到语音频道！');
        }

        const paused = musicPlayer.pause(message.guild.id);
        if (paused) {
            message.reply('⏸️ 已暂停播放！使用 `!play` 继续播放。');
        } else {
            message.reply('❌ 当前没有正在播放的内容！');
        }
    }

    // Stop music command
    if (command === '!stop') {
        if (!musicPlayer.connections.has(message.guild.id)) {
            return message.reply('❌ 我当前没有在播放任何内容！');
        }

        musicPlayer.stop(message.guild.id);
        message.reply('⏹️ 已停止播放并清空队列！');
    }

    // Leave voice channel command
    if (command === '!leave') {
        if (!musicPlayer.connections.has(message.guild.id)) {
            return message.reply('❌ 我当前不在任何语音频道！');
        }

        musicPlayer.leave(message.guild.id);
        message.reply('👋 已离开语音频道！');
    }

    // Queue command
    if (command === '!queue') {
        const queue = musicPlayer.getQueue(message.guild.id);
        if (queue.length === 0) {
            return message.reply('📭 队列是空的！');
        }

        const queueList = queue.map((song, index) => `${index + 1}. ${song.title}`).join('\n');
        message.reply(`📜 **当前队列：**\n\`\`\`${queueList}\`\`\``);
    }

    // Remove song from queue command
    if (command === '!remove') {
        const position = parseInt(args[1]);
        if (!position || position < 1) {
            return message.reply('❌ 请提供一个有效的位置序号！\n示例：`!remove 2` 表示移除队列中第 2 首\n用 `!queue` 查看序号。');
        }

        if (!musicPlayer.connections.has(message.guild.id)) {
            return message.reply('❌ 我当前没有连接到语音频道！');
        }

        const removedSong = musicPlayer.removeSong(message.guild.id, position);
        if (!removedSong) {
            return message.reply('❌ 位置无效或队列为空！\n用 `!queue` 查看当前队列。');
        }

        const currentQueue = musicPlayer.getQueue(message.guild.id);
        const queueLength = currentQueue.length;
        message.reply(`🗑️ 已从队列移除：**${removedSong.title}**\n📜 队列：**${queueLength} 首**`);
    }

    // Skip current song command
    if (command === '!skip') {
        if (!musicPlayer.connections.has(message.guild.id)) {
            return message.reply('❌ 我当前没有连接到语音频道！');
        }

        const skipped = musicPlayer.skip(message.guild.id);
        if (!skipped) {
            return message.reply('❌ 当前没有正在播放的内容！');
        }

        const currentQueue = musicPlayer.getQueue(message.guild.id);
        const queueLength = currentQueue.length;
        
        if (queueLength > 0) {
            message.reply(`⏭️ 已跳过当前歌曲！正在播放队列中的下一首...\n📜 队列：**${queueLength} 首**`);
        } else {
            message.reply('⏭️ 已跳过当前歌曲！队列已空。');
        }
    }

    // Add to queue command
    if (command === '!qadd' || command === '!queue-add') {
        const urls = args.slice(1); // Get all URLs after the command
        if (urls.length === 0) {
            return message.reply('❌ 请提供一个或多个 YouTube 或 Bilibili 链接！\n示例：`!qadd https://www.youtube.com/watch?v=... https://www.youtube.com/watch?v=...`');
        }

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ 你需要先加入语音频道才能把音乐加入队列！');
        }

        const loadingMsg = await message.reply(`🔄 正在把 ${urls.length} 首歌加入队列...`);

        try {
            // Join voice channel if not already connected
            if (!musicPlayer.connections.has(message.guild.id)) {
                await musicPlayer.joinChannel(
                    { guildId: message.guild.id, guild: message.guild }, 
                    voiceChannel
                );
            }

            const addedSongs = [];
            const failedSongs = [];

            // Process each URL
            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                try {
                    const songInfo = await musicPlayer.addUrlToQueue(
                        { guildId: message.guild.id, editReply: (msg) => loadingMsg.edit(`🔄 正在加入第 ${i + 1}/${urls.length} 首...`) }, 
                        url
                    );

                    if (songInfo) {
                        addedSongs.push(songInfo.title);
                    } else {
                        failedSongs.push(url);
                    }
                } catch (error) {
                    console.error(`Failed to add URL ${url}:`, error);
                    failedSongs.push(url);
                }
            }

            // Create response message
            const currentVolume = musicPlayer.getVolumePercentage(message.guild.id);
            const currentQueue = musicPlayer.getQueue(message.guild.id);
            const queueLength = currentQueue.length;

            let responseMessage = '';

            if (addedSongs.length > 0) {
                if (addedSongs.length === 1) {
                    responseMessage += `➕ 已加入队列：**${addedSongs[0]}**\n`;
                } else {
                    responseMessage += `➕ 已把 **${addedSongs.length}** 首歌加入队列：\n`;
                    addedSongs.slice(0, 5).forEach((title, index) => {
                        responseMessage += `${index + 1}. ${title}\n`;
                    });
                    if (addedSongs.length > 5) {
                        responseMessage += `... 还有 ${addedSongs.length - 5} 首\n`;
                    }
                }
            }

            if (failedSongs.length > 0) {
                responseMessage += `❌ 有 ${failedSongs.length} 首添加失败（链接无效）\n`;
            }

            responseMessage += `🔊 音量：**${currentVolume}%**\n📜 队列：**${queueLength} 首**`;

            loadingMsg.edit(responseMessage);

        } catch (error) {
            console.error(error);
            loadingMsg.edit('❌ 加入队列失败，请确认链接有效且可访问！');
        }
    }

    // Volume command (format: !<number> where number is 0-100)
    if (command.startsWith('!') && /^!\d+$/.test(command)) {
        const volumeLevel = parseInt(command.substring(1));
        
        if (volumeLevel < 0 || volumeLevel > 100) {
            return message.reply('❌ 音量必须在 0 到 100 之间！\n示例：`!50` 表示 50% 音量');
        }

        if (!musicPlayer.connections.has(message.guild.id)) {
            return message.reply('❌ 我当前没有连接到语音频道！请先使用 `!join`。');
        }

        const actualVolume = musicPlayer.setVolume(message.guild.id, volumeLevel);
        message.reply(`🔊 音量已设置为 **${actualVolume}%**`);
    }

    // Get current volume command
    if (command === '!volume') {
        if (!musicPlayer.connections.has(message.guild.id)) {
            return message.reply('❌ 我当前没有连接到语音频道！');
        }

        const currentVolume = musicPlayer.getVolumePercentage(message.guild.id);
        message.reply(`🔊 当前音量：**${currentVolume}%**`);
    }

    // Help command
    if (command === '!help') {
        const helpMessage = `
🎵 **音乐机器人指令：**

**基础指令：**
\`!ping\` - 测试机器人是否在线
\`!hello\` - 打个招呼
\`!help\` - 显示这条帮助信息

**音乐指令：**
\`!join\` - 加入你所在的语音频道
\`!play <链接>\` - 播放 YouTube/Bilibili 链接（若正在播放则自动加入队列）
\`!play\` - 不带链接时，继续已暂停的播放
\`!qadd <链接> [链接2] [链接3]...\` - 把一个或多个歌曲加入队列
\`!pause\` - 暂停当前播放
\`!stop\` - 停止播放并清空队列
\`!leave\` - 离开语音频道
\`!queue\` - 显示当前播放队列
\`!remove <序号>\` - 按位置移除队列中的歌曲
\`!skip\` - 跳过当前歌曲并播放队列下一首

**音量指令：**
\`!<数字>\` - 设置音量（0-100）。示例：\`!50\` 表示 50% 音量
\`!volume\` - 显示当前音量

**示例：**
\`!play https://www.youtube.com/watch?v=dQw4w9WgXcQ\` - 立即播放或加入队列
\`!qadd https://www.youtube.com/watch?v=abc123 https://www.youtube.com/watch?v=def456\` - 一次加入多首
\`!75\` - 音量设为 75%
\`!0\` - 静音
\`!100\` - 音量设为最大
\`!remove 2\` - 移除队列中第 2 首
\`!skip\` - 跳过当前歌曲

**队列规则说明：**
• 当前没有播放时：\`!play\` 会立即开始播放
• 正在播放时：\`!play\` 会把歌曲加入队列
• \`!qadd\` 永远都是加入队列（即使当前没有播放）
• 当前歌曲结束后会自动播放队列中的下一首
        `;
        message.reply(helpMessage);
    }
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN); 