const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    VoiceConnectionStatus,
    StreamType,
    getVoiceConnection
} = require('@discordjs/voice');
const youtubedl = require('youtube-dl-exec');

// Tell @discordjs/voice (prism-media) which ffmpeg binary to use
process.env.FFMPEG_PATH = require('ffmpeg-static');

// Basic YouTube URL validation
function isYouTubeUrl(url) {
    return /(?:youtube\.com\/(?:watch\?|shorts\/|embed\/|live\/)|youtu\.be\/)/i.test(url);
}

// Fetch video metadata (title, duration) via yt-dlp
async function getVideoInfo(url) {
    const info = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noPlaylist: true,
    });
    return info;
}

// Spawn a yt-dlp process that streams best audio to stdout
function createYtdlpStream(url) {
    const subprocess = youtubedl.exec(url, {
        output: '-',
        format: 'bestaudio[ext=webm]/bestaudio/best',
        quiet: true,
        noWarnings: true,
        noPlaylist: true,
    }, { stdio: ['ignore', 'pipe', 'ignore'] });

    subprocess.catch(() => {}); // swallow broken-pipe errors on skip/stop
    return { stream: subprocess.stdout, subprocess };
}

class MusicPlayer {
    constructor() {
        this.queue = new Map(); // Guild ID -> Queue
        this.players = new Map(); // Guild ID -> Audio Player
        this.connections = new Map(); // Guild ID -> Voice Connection
        this.volumes = new Map(); // Guild ID -> Volume (0.0 to 1.0)
        this.processes = new Map(); // Guild ID -> current yt-dlp subprocess
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            console.log('ytdl-core initialized successfully');
            this.initialized = true;
        }
    }

    async joinChannel(interaction, channel) {
        const guildId = interaction.guildId;
        
        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            this.connections.set(guildId, connection);

            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log('Voice connection ready!');
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                console.log('Voice connection disconnected');
                this.cleanup(guildId);
            });

            return connection;
        } catch (error) {
            console.error('Error joining voice channel:', error);
            throw error;
        }
    }

    async playUrl(interaction, url) {
        const guildId = interaction.guildId;
        
        try {
            // Initialize ytdl-core if not already done
            await this.initialize();
            
            let stream;
            let subprocess;
            let title;
            let duration;
            
            // Check if it's a YouTube URL
            if (isYouTubeUrl(url)) {
                console.log('Getting video info for:', url);
                const info = await getVideoInfo(url);
                title = info.title;
                duration = info.duration;
                console.log('Video title:', title);
                
                // Get audio stream via yt-dlp
                console.log('Creating audio stream...');
                const result = createYtdlpStream(url);
                stream = result.stream;
                subprocess = result.subprocess;
                
                if (!stream) {
                    throw new Error('Could not get audio stream from this video');
                }
            }
            // Check if it's a Bilibili URL (basic support)
            else if (url.includes('bilibili.com')) {
                // For Bilibili, we'll need a different approach
                // This is a simplified version - you might need additional libraries for full Bilibili support
                if (interaction.editReply) {
                    await interaction.editReply('⚠️ Bilibili 支持有限，建议使用 YouTube 链接以获得最佳效果。');
                }
                return;
            }
            else {
                throw new Error('Unsupported URL format. Please use YouTube URLs.');
            }

            // Kill any previous yt-dlp process for this guild
            this.killProcess(guildId);
            if (subprocess) {
                this.processes.set(guildId, subprocess);
            }

            console.log('Creating audio resource...');
            const resource = createAudioResource(stream, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true
            });
            
            // Set volume for the resource
            const currentVolume = this.getVolume(guildId);
            if (resource.volume) {
                resource.volume.setVolume(currentVolume);
            }
            
            if (!resource) {
                throw new Error('Failed to create audio resource');
            }

            let player = this.players.get(guildId);
            if (!player) {
                player = createAudioPlayer();
                this.players.set(guildId, player);
                
                player.on(AudioPlayerStatus.Playing, () => {
                    console.log('Audio player is playing');
                });

                player.on(AudioPlayerStatus.Idle, () => {
                    console.log('Audio player is idle');
                    this.playNext(guildId);
                });

                player.on('error', error => {
                    console.error('Audio player error:', error);
                });
            }

            const connection = this.connections.get(guildId);
            if (connection) {
                connection.subscribe(player);
                player.play(resource);
                
                return {
                    title: title,
                    duration: duration,
                    url: url
                };
            }
        } catch (error) {
            console.error('Error playing audio:', error);
            throw error;
        }
    }

    addToQueue(guildId, songInfo) {
        if (!this.queue.has(guildId)) {
            this.queue.set(guildId, []);
        }
        this.queue.get(guildId).push(songInfo);
    }

    async addUrlToQueue(interaction, url) {
        const guildId = interaction.guildId;
        
        try {
            // Initialize ytdl-core if not already done
            await this.initialize();
            
            // Check if it's a YouTube URL
            if (isYouTubeUrl(url)) {
                console.log('Getting video info for queue:', url);
                const info = await getVideoInfo(url);
                console.log('Video title for queue:', info.title);
                
                const songInfo = {
                    title: info.title,
                    duration: info.duration,
                    url: url
                };
                
                this.addToQueue(guildId, songInfo);
                return songInfo;
            }
            // Check if it's a Bilibili URL (basic support)
            else if (url.includes('bilibili.com')) {
                // For Bilibili, we'll need a different approach
                if (interaction.editReply) {
                    await interaction.editReply('⚠️ Bilibili 支持有限，建议使用 YouTube 链接以获得最佳效果。');
                }
                return null;
            }
            else {
                throw new Error('Unsupported URL format. Please use YouTube URLs.');
            }
        } catch (error) {
            console.error('Error adding to queue:', error);
            throw error;
        }
    }

    async playNext(guildId) {
        const queue = this.queue.get(guildId);
        if (queue && queue.length > 0) {
            const nextSong = queue.shift();
            try {
                await this.playUrl({ guildId }, nextSong.url);
            } catch (error) {
                console.error('Error playing next song:', error);
                this.playNext(guildId); // Try the next song
            }
        }
    }

    killProcess(guildId) {
        const proc = this.processes.get(guildId);
        if (proc) {
            try { proc.kill('SIGKILL'); } catch (e) { /* already exited */ }
            this.processes.delete(guildId);
        }
    }

    stop(guildId) {
        const player = this.players.get(guildId);
        if (player) {
            player.stop();
        }
        this.killProcess(guildId);
        this.queue.set(guildId, []);
    }

    leave(guildId) {
        const connection = this.connections.get(guildId);
        if (connection) {
            connection.destroy();
        }
        this.cleanup(guildId);
    }

    cleanup(guildId) {
        this.killProcess(guildId);
        this.connections.delete(guildId);
        this.players.delete(guildId);
        this.queue.delete(guildId);
        this.volumes.delete(guildId);
    }

    getQueue(guildId) {
        return this.queue.get(guildId) || [];
    }

    isPlaying(guildId) {
        const player = this.players.get(guildId);
        return player && player.state.status === AudioPlayerStatus.Playing;
    }

    setVolume(guildId, volume) {
        // Clamp volume between 0 and 100, then convert to 0.0-1.0 range
        const clampedVolume = Math.max(0, Math.min(100, volume));
        const normalizedVolume = clampedVolume / 100;
        this.volumes.set(guildId, normalizedVolume);
        
        // Apply volume to currently playing audio if exists
        const player = this.players.get(guildId);
        if (player && player.state.resource && player.state.resource.volume) {
            player.state.resource.volume.setVolume(normalizedVolume);
        }
        
        return clampedVolume;
    }

    getVolume(guildId) {
        return this.volumes.get(guildId) || 0.5; // Default to 50% volume
    }

    getVolumePercentage(guildId) {
        return Math.round(this.getVolume(guildId) * 100);
    }

    removeSong(guildId, position) {
        const queue = this.queue.get(guildId);
        if (!queue || queue.length === 0) {
            return null; // Queue is empty
        }
        
        // Convert to 0-based index
        const index = position - 1;
        if (index < 0 || index >= queue.length) {
            return null; // Invalid position
        }
        
        // Remove and return the song
        const removedSong = queue.splice(index, 1)[0];
        return removedSong;
    }

    skip(guildId) {
        const player = this.players.get(guildId);
        if (!player || player.state.status !== AudioPlayerStatus.Playing) {
            return false; // Nothing is playing
        }
        
        // Stop current song - this will trigger the 'idle' event and play next song
        player.stop();
        return true;
    }

    pause(guildId) {
        const player = this.players.get(guildId);
        if (!player || player.state.status !== AudioPlayerStatus.Playing) {
            return false; // Nothing is playing to pause
        }
        return player.pause();
    }

    resume(guildId) {
        const player = this.players.get(guildId);
        if (!player || player.state.status !== AudioPlayerStatus.Paused) {
            return false; // Nothing is paused to resume
        }
        return player.unpause();
    }
}

module.exports = { MusicPlayer }; 