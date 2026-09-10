# 🎵 Discord Music Bot

A Discord bot that plays audio from YouTube and Bilibili URLs with smart queue management and volume control.

## ✨ Features

- 🎵 Play from YouTube/Bilibili URLs
- 🔄 Smart queue system with auto-play
- 🔊 Volume control (0-100%)
- ➕ Add multiple songs at once
- ⏭️ Skip, remove, and manage queue

## 🚀 Quick Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure bot:**
   - Copy `env.example` to `.env`
   - Add your Discord bot token: `DISCORD_TOKEN=your_token_here`

3. **Run:**
   ```bash
   node index.js
   ```

## 🎮 Commands

### Music Controls
| Command | Description | Example |
|---------|-------------|---------|
| `!join` | Join voice channel | `!join` |
| `!play <url>` | Play song (smart queue) | `!play https://youtube.com/watch?v=abc` |
| `!qadd <url> [url2]...` | Add to queue | `!qadd url1 url2 url3` |
| `!queue` | Show queue | `!queue` |
| `!skip` | Skip current song | `!skip` |
| `!remove <#>` | Remove from queue | `!remove 2` |
| `!stop` | Stop and clear | `!stop` |
| `!leave` | Leave channel | `!leave` |

### Volume Controls
| Command | Description |
|---------|-------------|
| `!<number>` | Set volume (0-100) |
| `!volume` | Show current volume |

### Other
| Command | Description |
|---------|-------------|
| `!help` | Show help |
| `!ping` | Test bot |

## 🎯 Quick Start

```bash
!join                    # Join your voice channel
!play <youtube-url>      # Start playing
!75                      # Set volume to 75%
!qadd url1 url2          # Add multiple songs
!queue                   # View queue
!skip                    # Skip to next
```

## 💡 How It Works

- **`!play`**: Plays immediately if nothing playing, otherwise adds to queue
- **`!qadd`**: Always adds to queue (even when nothing playing)
- **Queue**: Songs auto-play when current song ends
- **Volume**: Use numbers 0-100 (e.g., `!50` for 50%)

## 🔧 Troubleshooting

**Not working?**
- Join a voice channel first
- Check bot permissions
- Verify URL is valid
- Restart bot if needed

**Common errors:**
- "You need to be in a voice channel" → Join voice channel
- "I'm not in a voice channel" → Use `!join`
- "Volume must be between 0 and 100" → Use valid numbers

## 📝 Notes

- Supports YouTube (full) and Bilibili (limited)
- Default volume: 50%
- Settings reset on bot restart
- Use `!help` in Discord for quick reference

---

**Ready to rock? 🎸** Start with `!join` then `!play <your-url>`!