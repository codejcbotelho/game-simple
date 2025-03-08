class Map {
    constructor(id, platforms = [], enemies = [], items = []) {
        this.id = id;
        this.platforms = platforms;
        this.enemies = enemies.map(enemy => ({
            ...enemy,
            isAlive: true
        }));
        this.items = items.map(item => ({
            ...item,
            collected: false
        }));
        this.visited = false;
    }

    reset() {
        // Reseta apenas a posição dos inimigos, mantendo seu estado (vivo/morto)
        this.enemies = this.enemies.map(enemy => ({
            ...enemy,
            x: enemy.initialX,
            y: enemy.initialY
        }));
    }
}

class Game {
    constructor() {
        this.player = document.getElementById('player');
        this.gameContainer = document.querySelector('.game-container');
        
        // Sistema de mapas
        this.maps = this.createMaps();
        this.currentMapIndex = 0;
        
        this.playerPos = {
            x: 50,
            y: 460
        };
        this.velocity = {
            x: 0,
            y: 0
        };
        this.isJumping = false;
        this.gravity = 0.5;
        this.jumpForce = -12;
        this.speed = 5;

        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
        };

        this.setupMap(this.currentMapIndex);
        this.updatePlayerPosition();
        this.setupControls();
        this.gameLoop();
    }

    createMaps() {
        return [
            new Map(0, [
                { x: 0, y: 560, width: 800, height: 40, color: '#4a4a4a' }, // Plataforma base
                { x: 200, y: 400, width: 100, height: 20, color: '#666' }   // Plataforma flutuante
            ], [
                { initialX: 300, initialY: 520, width: 30, height: 30, color: '#ff6b6b', speed: 2 }
            ]),
            new Map(1, [
                { x: 0, y: 560, width: 800, height: 40, color: '#4a4a4a' },
                { x: 400, y: 300, width: 200, height: 20, color: '#666' }
            ], [
                { initialX: 500, initialY: 520, width: 30, height: 30, color: '#ff6b6b', speed: 3 }
            ]),
            new Map(2, [
                { x: 0, y: 560, width: 800, height: 40, color: '#4a4a4a' },
                { x: 100, y: 450, width: 100, height: 20, color: '#666' },
                { x: 300, y: 350, width: 100, height: 20, color: '#666' },
                { x: 500, y: 250, width: 100, height: 20, color: '#666' }
            ], [
                { initialX: 400, initialY: 520, width: 30, height: 30, color: '#ff6b6b', speed: 2.5 }
            ])
        ];
    }

    setupMap(mapIndex) {
        // Limpar elementos existentes
        const platforms = this.gameContainer.querySelectorAll('.platform, .enemy');
        platforms.forEach(platform => platform.remove());

        const currentMap = this.maps[mapIndex];
        currentMap.visited = true;

        // Criar plataformas
        currentMap.platforms.forEach(platform => {
            const platformElement = document.createElement('div');
            platformElement.className = 'platform';
            platformElement.style.cssText = `
                position: absolute;
                left: ${platform.x}px;
                top: ${platform.y}px;
                width: ${platform.width}px;
                height: ${platform.height}px;
                background-color: ${platform.color};
            `;
            this.gameContainer.appendChild(platformElement);
        });

        // Criar inimigos
        currentMap.enemies.forEach(enemy => {
            if (enemy.isAlive) {
                const enemyElement = document.createElement('div');
                enemyElement.className = 'enemy';
                enemyElement.style.cssText = `
                    position: absolute;
                    left: ${enemy.initialX}px;
                    top: ${enemy.initialY}px;
                    width: ${enemy.width}px;
                    height: ${enemy.height}px;
                    background-color: ${enemy.color};
                `;
                this.gameContainer.appendChild(enemyElement);
            }
        });
    }

    changeMap(direction) {
        // direction: 1 para direita, -1 para esquerda
        const newMapIndex = this.currentMapIndex + direction;
        
        if (newMapIndex >= 0 && newMapIndex < this.maps.length) {
            this.currentMapIndex = newMapIndex;
            this.setupMap(this.currentMapIndex);
            
            // Ajustar posição do jogador
            if (direction > 0) {
                this.playerPos.x = 50; // Início do mapa
            } else {
                this.playerPos.x = 710; // Final do mapa
            }
        }
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = true;
            }
            
            if (key === 'w' && !this.isJumping) {
                this.velocity.y = this.jumpForce;
                this.isJumping = true;
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = false;
            }
        });
    }

    updatePlayerPosition() {
        this.player.style.transform = `translate(${this.playerPos.x}px, ${this.playerPos.y}px)`;
    }

    checkPlatformCollisions() {
        const currentMap = this.maps[this.currentMapIndex];
        let onPlatform = false;

        currentMap.platforms.forEach(platform => {
            const playerBottom = this.playerPos.y + 40;
            const playerRight = this.playerPos.x + 40;

            // Colisão vertical (queda na plataforma)
            if (this.playerPos.x < platform.x + platform.width &&
                playerRight > platform.x &&
                playerBottom >= platform.y &&
                this.playerPos.y < platform.y) {
                
                this.playerPos.y = platform.y - 40;
                this.velocity.y = 0;
                this.isJumping = false;
                onPlatform = true;
            }
        });

        return onPlatform;
    }

    update() {
        // Movimento horizontal
        if (this.keys.a) {
            this.velocity.x = -this.speed;
        } else if (this.keys.d) {
            this.velocity.x = this.speed;
        } else {
            this.velocity.x = 0;
        }

        // Aplicar gravidade
        this.velocity.y += this.gravity;

        // Atualizar posição
        this.playerPos.x += this.velocity.x;
        this.playerPos.y += this.velocity.y;

        // Verificar colisões com plataformas
        if (!this.checkPlatformCollisions()) {
            // Se não estiver em nenhuma plataforma, verificar colisão com o chão
            const floor = 520;
            if (this.playerPos.y > floor) {
                this.playerPos.y = floor;
                this.velocity.y = 0;
                this.isJumping = false;
            }
        }

        // Verificar mudança de mapa
        if (this.playerPos.x > 760) {
            this.changeMap(1);
        } else if (this.playerPos.x < 0) {
            this.changeMap(-1);
        }

        // Limites horizontais do mapa atual
        if (this.playerPos.x < 0) this.playerPos.x = 0;
        if (this.playerPos.x > 760) this.playerPos.x = 760;

        // Atualizar posição visual do player
        this.updatePlayerPosition();
    }

    gameLoop() {
        this.update();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Iniciar o jogo quando a página carregar
window.addEventListener('load', () => {
    new Game();
}); 