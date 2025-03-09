class Map {
    constructor(mapData) {
        this.id = mapData.id;
        this.name = mapData.name;
        this.description = mapData.description;
        this.platforms = mapData.platforms;
        this.enemies = mapData.enemies.map(enemy => ({
            ...enemy,
            isAlive: true,
            x: enemy.initialX,
            y: enemy.initialY
        }));
        this.items = mapData.items.map(item => ({
            ...item,
            collected: false
        }));
        this.connections = mapData.connections;
        this.backgroundColor = mapData.backgroundColor;
        this.visited = false;
    }

    reset() {
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
        
        this.loadMaps().then(() => {
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
            this.isOnLadder = false;
            this.gravity = 0.5;
            this.jumpForce = -12;
            this.speed = 5;
            this.fallThreshold = 600;
            this.score = 0;
            this.health = 100;
            this.projectiles = [];
            this.lastDamageTime = 0;
            this.damageInvincibilityTime = 1000; // 1 segundo de invencibilidade após dano

            this.keys = {
                w: false,
                a: false,
                s: false,
                d: false,
                ' ': false
            };

            // Criar HUD
            this.createHUD();
            this.setupMap(this.currentMapIndex);
            this.updatePlayerPosition();
            this.setupControls();
            this.gameLoop();
        });
    }

    async loadMaps() {
        try {
            const response = await fetch('maps.json');
            const data = await response.json();
            this.maps = data.maps.map(mapData => new Map(mapData));
        } catch (error) {
            console.error('Erro ao carregar os mapas:', error);
            // Fallback para mapas básicos em caso de erro
            this.maps = [
                new Map({
                    id: 0,
                    name: "Mapa Básico",
                    platforms: [{ x: 0, y: 560, width: 800, height: 40, color: "#4a4a4a", type: "ground" }],
                    enemies: [],
                    items: [],
                    connections: {},
                    backgroundColor: "#000"
                })
            ];
        }
    }

    setupMap(mapIndex) {
        // Limpar elementos existentes
        const elements = this.gameContainer.querySelectorAll('.platform, .enemy, .item');
        elements.forEach(element => element.remove());

        const currentMap = this.maps[mapIndex];
        currentMap.visited = true;

        // Definir cor de fundo
        this.gameContainer.style.backgroundColor = currentMap.backgroundColor;

        // Criar plataformas
        currentMap.platforms.forEach(platform => {
            const platformElement = document.createElement('div');
            platformElement.className = `platform ${platform.type}`;
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
                enemyElement.className = `enemy ${enemy.type}`;
                enemyElement.style.cssText = `
                    position: absolute;
                    left: ${enemy.x}px;
                    top: ${enemy.y}px;
                    width: ${enemy.width}px;
                    height: ${enemy.height}px;
                    background-color: ${enemy.color};
                `;
                this.gameContainer.appendChild(enemyElement);
            }
        });

        // Criar itens
        currentMap.items.forEach(item => {
            if (!item.collected) {
                const itemElement = document.createElement('div');
                itemElement.className = `item ${item.type}`;
                itemElement.style.cssText = `
                    position: absolute;
                    left: ${item.x}px;
                    top: ${item.y}px;
                    width: 20px;
                    height: 20px;
                    background-color: gold;
                    border-radius: 50%;
                    z-index: 5;
                `;
                this.gameContainer.appendChild(itemElement);
            }
        });
    }

    createHUD() {
        const hud = document.createElement('div');
        hud.className = 'hud';
        hud.innerHTML = `
            <div class="health">HP: <span id="health">100</span></div>
            <div class="score">Score: <span id="score">0</span></div>
        `;
        this.gameContainer.appendChild(hud);
    }

    updateHUD() {
        document.getElementById('health').textContent = this.health;
        document.getElementById('score').textContent = this.score;
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = true;
                e.preventDefault();
            }
            
            if (key === 'w' && !this.isJumping && !this.isOnLadder) {
                this.velocity.y = this.jumpForce;
                this.isJumping = true;
            }

            if (key === ' ') {
                this.shootProjectile();
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = false;
            }
        });
    }

    shootProjectile() {
        const projectile = document.createElement('div');
        projectile.className = 'projectile';
        
        let direction = { x: 0, y: 0 };
        
        // Determinar direção do tiro
        if (this.keys.w) {
            // Tiro para cima
            direction.y = -1;
            direction.x = 0;
        } else {
            // Tiro horizontal
            direction.x = this.player.style.transform.includes('scaleX(-1)') ? -1 : 1;
            direction.y = 0;
        }

        const speed = 10;
        
        const projectileData = {
            element: projectile,
            x: this.playerPos.x + 20, // Centro do jogador
            y: this.playerPos.y + (direction.y < 0 ? 0 : 20), // Topo ou meio do jogador
            velocityX: direction.x * speed,
            velocityY: direction.y * speed
        };

        projectile.style.cssText = `
            position: absolute;
            left: ${projectileData.x}px;
            top: ${projectileData.y}px;
            width: 10px;
            height: 10px;
            background-color: #fff;
            border-radius: 50%;
            z-index: 8;
            box-shadow: 0 0 5px #fff;
        `;

        this.gameContainer.appendChild(projectile);
        this.projectiles.push(projectileData);
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            // Atualizar posição do projétil
            projectile.x += projectile.velocityX;
            projectile.y += projectile.velocityY;
            
            // Atualizar visual do projétil
            projectile.element.style.left = `${projectile.x}px`;
            projectile.element.style.top = `${projectile.y}px`;

            // Verificar colisão com inimigos
            const currentMap = this.maps[this.currentMapIndex];
            for (let enemy of currentMap.enemies) {
                if (enemy.isAlive) {
                    // Criar uma área de colisão maior para o projétil
                    const projectileHitbox = {
                        x: projectile.x - 5,
                        y: projectile.y - 5,
                        width: 20,
                        height: 20
                    };

                    // Verificar colisão com a hitbox expandida
                    if (this.checkCollision(
                        projectileHitbox.x, projectileHitbox.y,
                        projectileHitbox.width, projectileHitbox.height,
                        enemy.x, enemy.y, enemy.width, enemy.height
                    )) {
                        // Efeito visual de explosão
                        const explosion = document.createElement('div');
                        explosion.className = 'explosion';
                        explosion.style.cssText = `
                            position: absolute;
                            left: ${enemy.x}px;
                            top: ${enemy.y}px;
                            width: ${enemy.width}px;
                            height: ${enemy.height}px;
                        `;
                        this.gameContainer.appendChild(explosion);
                        
                        // Remover explosão após a animação
                        setTimeout(() => explosion.remove(), 300);

                        // Marcar inimigo como morto e remover
                        enemy.isAlive = false;
                        this.score += 50;
                        const enemyElement = this.gameContainer.querySelector(`.enemy[style*="left: ${Math.round(enemy.x)}px"]`);
                        if (enemyElement) enemyElement.remove();
                        
                        // Remover projétil
                        projectile.element.remove();
                        this.projectiles.splice(i, 1);
                        break;
                    }
                }
            }

            // Remover projéteis fora da tela
            if (projectile.x < 0 || projectile.x > 800 || 
                projectile.y < 0 || projectile.y > 600) {
                projectile.element.remove();
                this.projectiles.splice(i, 1);
            }
        }
    }

    checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 &&
               x1 + w1 > x2 &&
               y1 < y2 + h2 &&
               y1 + h1 > y2;
    }

    checkLadderCollision() {
        const currentMap = this.maps[this.currentMapIndex];
        this.isOnLadder = false;

        currentMap.platforms.forEach(platform => {
            if (platform.type === 'ladder') {
                if (this.checkCollision(
                    this.playerPos.x, this.playerPos.y, 40, 40,
                    platform.x, platform.y, platform.width, platform.height
                )) {
                    this.isOnLadder = true;
                }
            }
        });

        return this.isOnLadder;
    }

    checkEnemyCollision() {
        const currentMap = this.maps[this.currentMapIndex];
        const currentTime = Date.now();

        if (currentTime - this.lastDamageTime < this.damageInvincibilityTime) {
            return;
        }

        currentMap.enemies.forEach(enemy => {
            if (enemy.isAlive && this.checkCollision(
                this.playerPos.x, this.playerPos.y, 40, 40,
                enemy.x, enemy.y, enemy.width, enemy.height
            )) {
                this.health -= 10;
                this.lastDamageTime = currentTime;
                this.player.classList.add('damaged');
                setTimeout(() => this.player.classList.remove('damaged'), 200);

                if (this.health <= 0) {
                    alert('Game Over!');
                    location.reload();
                }
            }
        });
    }

    checkItemCollision() {
        const currentMap = this.maps[this.currentMapIndex];
        
        currentMap.items.forEach(item => {
            if (!item.collected && this.checkCollision(
                this.playerPos.x, this.playerPos.y, 40, 40,
                item.x, item.y, 20, 20
            )) {
                item.collected = true;
                if (item.type === 'coin') {
                    this.score += item.value;
                }
                const itemElement = this.gameContainer.querySelector(`.item[style*="left: ${item.x}px"]`);
                if (itemElement) {
                    itemElement.remove();
                }
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
            this.player.style.transform = `translate(${this.playerPos.x}px, ${this.playerPos.y}px) scaleX(-1)`;
        } else if (this.keys.d) {
            this.velocity.x = this.speed;
            this.player.style.transform = `translate(${this.playerPos.x}px, ${this.playerPos.y}px)`;
        } else {
            this.velocity.x = 0;
        }

        // Verificar escada
        this.checkLadderCollision();

        // Movimento vertical na escada
        if (this.isOnLadder) {
            this.velocity.y = 0;
            if (this.keys.w) {
                this.velocity.y = -this.speed;
            } else if (this.keys.s) {
                this.velocity.y = this.speed;
            }
        } else {
            // Aplicar gravidade quando não estiver na escada
            this.velocity.y += this.gravity;
        }

        // Atualizar posição
        this.playerPos.x += this.velocity.x;
        this.playerPos.y += this.velocity.y;

        // Verificar colisões
        if (!this.isOnLadder && !this.checkPlatformCollisions()) {
            const floor = 520;
            if (this.playerPos.y > floor) {
                this.playerPos.y = floor;
                this.velocity.y = 0;
                this.isJumping = false;
            }
        }

        // Verificar mudança vertical de mapa
        if (this.isOnLadder) {
            const currentMap = this.maps[this.currentMapIndex];
            if (this.playerPos.y < -40 && currentMap.connections.top !== undefined) {
                this.changeMap(currentMap.connections.top, 'top');
            } else if (this.playerPos.y > 600 && currentMap.connections.bottom !== undefined) {
                this.changeMap(currentMap.connections.bottom, 'bottom');
            }
        }

        // Verificar mudança horizontal de mapa
        const currentMap = this.maps[this.currentMapIndex];
        if (this.playerPos.x > 760 && currentMap.connections.right !== undefined) {
            this.changeMap(currentMap.connections.right, 'right');
        } else if (this.playerPos.x < 0 && currentMap.connections.left !== undefined) {
            this.changeMap(currentMap.connections.left, 'left');
        }

        // Limites horizontais do mapa atual
        if (this.playerPos.x < 0) this.playerPos.x = 0;
        if (this.playerPos.x > 760) this.playerPos.x = 760;

        // Atualizar projéteis
        this.updateProjectiles();

        // Verificar colisões com inimigos e itens
        this.checkEnemyCollision();
        this.checkItemCollision();

        // Atualizar HUD
        this.updateHUD();

        // Atualizar posição visual do player
        if (!this.keys.a && !this.keys.d) {
            this.updatePlayerPosition();
        }
    }

    changeMap(newMapIndex, direction) {
        this.currentMapIndex = newMapIndex;
        this.setupMap(this.currentMapIndex);
        
        switch (direction) {
            case 'right':
                this.playerPos.x = 50;
                break;
            case 'left':
                this.playerPos.x = 710;
                break;
            case 'top':
                this.playerPos.y = 520;
                break;
            case 'bottom':
                this.playerPos.y = 0;
                break;
        }
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