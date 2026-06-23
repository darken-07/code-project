# ⚔️ 3D 枪战游戏

一个基于 Three.js 的 3D 第一人称射击游戏。消灭敌人，生存到最后！

## 🎮 在线试玩

👉 [在线试玩](https://你的用户名.github.io/3d-shooter-game/)（部署到 GitHub Pages 后可用）

## 🕹️ 操作说明

| 按键 | 功能 |
|------|------|
| **W A S D** | 移动 |
| **鼠标** | 瞄准 |
| **左键** | 射击 |
| **R** | 换弹 |
| **Shift** | 奔跑 |
| **Space** | 跳跃 |
| **1 / 2** | 切换武器 |
| **Q** | 切换自动/单发模式 |

## 🎯 游戏特性

- 🔥 **双武器系统**：手枪 & 冲锋枪，可随时切换
- 👾 **4种敌人类型**：普通兵、冲锋兵、坦克兵、远程射手
- 🌊 **波次系统**：难度递增的生存挑战
- ❤️ **拾取系统**：血包和弹药补给
- 🏙️ **3D场景**：包含建筑物、路灯、围墙等
- 📊 **HUD界面**：血量、弹药、分数、击杀数

## 🚀 本地运行

```bash
git clone https://github.com/你的用户名/3d-shooter-game.git
cd 3d-shooter-game
# 使用任意 HTTP 服务器运行
npx serve .
# 或使用 Python
python -m http.server 8080
# 然后在浏览器打开 http://localhost:8080
```

## 🛠️ 技术栈

- [Three.js](https://threejs.org/) - 3D 渲染引擎
- 原生 JavaScript 模块
- 纯前端，无需后端

## 📂 项目结构

```
3d-shooter-game/
├── index.html     # 入口页面
├── css/
│   └── style.css  # 样式文件
├── js/
│   ├── main.js    # 游戏入口与主循环
│   ├── scene.js   # 3D场景构建
│   ├── player.js  # 玩家控制
│   ├── enemy.js   # 敌人AI
│   ├── game.js    # 物品与特效
│   └── hud.js     # HUD界面
└── README.md
```

## 📄 许可

MIT License
