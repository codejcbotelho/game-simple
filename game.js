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
        this.isPaused = false;
        this.createStartScreen();
    }

    createStartScreen() {
        this.startScreen = document.createElement('div');
        this.startScreen.className = 'start-screen';
        
        const startButton = document.createElement('button');
        startButton.className = 'start-button';
        startButton.textContent = 'Começar Jogo';
        
        const credits = document.createElement('div');
        credits.className = 'credits';
        credits.textContent = 'Feito por JC Botelho com IA';
        
        this.startScreen.appendChild(startButton);
        this.startScreen.appendChild(credits);
        
        document.querySelector('.game-container').appendChild(this.startScreen);
        
        startButton.addEventListener('click', () => {
            this.startScreen.remove();
            this.initializeGame();
        });
    }

    initializeGame() {
        // Criar o elemento do jogador se ele não existir
        this.player = document.getElementById('player');
        if (!this.player) {
            this.player = document.createElement('div');
            this.player.id = 'player';
            document.querySelector('.game-container').appendChild(this.player);
        }
        
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
            this.enemies = []; // Inicializar o array de inimigos
            this.lastDamageTime = 0;
            this.damageInvincibilityTime = 1000;

            this.keys = {
                w: false,
                a: false,
                s: false,
                d: false,
                ' ': false
            };

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
        const currentMap = this.maps[mapIndex];
        this.currentMapIndex = mapIndex;
        
        // Limpar elementos existentes
        const platforms = document.querySelectorAll('.platform');
        platforms.forEach(platform => platform.remove());
        
        const existingEnemies = document.querySelectorAll('.enemy');
        existingEnemies.forEach(enemy => enemy.remove());
        
        const items = document.querySelectorAll('.item');
        items.forEach(item => item.remove());
        
        // Limpar o array de inimigos
        this.enemies = [];
        
        // Definir a cor de fundo
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
        if (currentMap.enemies) {
            currentMap.enemies.forEach(enemy => {
                const enemyElement = document.createElement('div');
                enemyElement.className = `enemy ${enemy.type}`;
                enemyElement.style.width = `${enemy.width}px`;
                enemyElement.style.height = `${enemy.height}px`;
                enemyElement.style.left = `${enemy.initialX}px`;
                enemyElement.style.top = `${enemy.initialY}px`;
                
                // Adicionar barra de vida
                const healthBar = document.createElement('div');
                healthBar.className = 'enemy-health-bar';
                const healthFill = document.createElement('div');
                healthFill.className = 'enemy-health-fill';
                healthBar.appendChild(healthFill);
                enemyElement.appendChild(healthBar);
                
                this.gameContainer.appendChild(enemyElement);
                
                // Configurar atributos do inimigo baseado no tipo
                let health = 100;
                let damage = 10;
                let points = 50;
                
                switch(enemy.type) {
                    case 'armored':
                        health = 200;
                        damage = 20;
                        points = 100;
                        break;
                    case 'boss':
                        health = 500;
                        damage = 30;
                        points = 500;
                        break;
                }
                
                // Configurar comportamento de movimento específico para cada tipo
                let movementType = 'patrol';
                
                switch(enemy.type) {
                    case 'basic':
                        movementType = 'patrol';
                        break;
                    case 'armored':
                        movementType = 'chase';
                        break;
                    case 'boss':
                        movementType = 'complex';
                        break;
                }
                
                this.enemies.push({
                    element: enemyElement,
                    health: health,
                    maxHealth: health,
                    damage: damage,
                    points: points,
                    x: enemy.initialX,
                    y: enemy.initialY,
                    width: enemy.width,
                    height: enemy.height,
                    type: enemy.type,
                    movementType: movementType,
                    initialX: enemy.initialX,
                    speed: enemy.speed || (enemy.type === 'basic' ? 3 : enemy.type === 'armored' ? 2 : 1),
                    facingLeft: false,
                    patrolDistance: enemy.patrolDistance || 150,
                    direction: 1,
                    isChasing: false,
                    jumpTimer: 0,
                    isJumping: false
                });
            });

            // Atualizar contagem de inimigos e barra de progresso
            this.totalEnemies = this.enemies.length;
            this.remainingEnemies = this.totalEnemies;
            this.updateProgress();
        }

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

    createPauseScreen() {
        this.pauseScreen = document.createElement('div');
        this.pauseScreen.className = 'pause-screen';
        
        const pauseTitle = document.createElement('div');
        pauseTitle.className = 'pause-title';
        pauseTitle.textContent = 'Jogo Pausado';
        
        const continueButton = document.createElement('button');
        continueButton.className = 'pause-button';
        continueButton.textContent = 'Continuar';
        
        const quitButton = document.createElement('button');
        quitButton.className = 'pause-button';
        quitButton.textContent = 'Sair do Jogo';
        
        this.pauseScreen.appendChild(pauseTitle);
        this.pauseScreen.appendChild(continueButton);
        this.pauseScreen.appendChild(quitButton);
        
        continueButton.addEventListener('click', () => this.unpauseGame());
        quitButton.addEventListener('click', () => this.quitGame());
        
        this.gameContainer.appendChild(this.pauseScreen);
    }

    pauseGame() {
        if (!this.isPaused) {
            this.isPaused = true;
            this.gameContainer.classList.add('paused');
            
            // Pausar todas as animações existentes
            const animatedElements = this.gameContainer.querySelectorAll('.enemy, .item, .projectile, .explosion');
            animatedElements.forEach(element => {
                element.style.animationPlayState = 'paused';
            });
            
            this.createPauseScreen();
        }
    }

    unpauseGame() {
        if (this.isPaused) {
            this.isPaused = false;
            this.gameContainer.classList.remove('paused');
            
            // Retomar todas as animações
            const animatedElements = this.gameContainer.querySelectorAll('.enemy, .item, .projectile, .explosion');
            animatedElements.forEach(element => {
                element.style.animationPlayState = 'running';
            });
            
            this.pauseScreen.remove();
        }
    }

    quitGame() {
        // Limpar o container do jogo
        while (this.gameContainer.firstChild) {
            this.gameContainer.firstChild.remove();
        }
        
        // Reiniciar o jogo voltando para a tela inicial
        this.isPaused = false;
        this.createStartScreen();
    }

    setupControls() {
        // Criar referências para os handlers que possam ser removidos depois
        this.handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            
            // Verificar tecla ESC para pausar
            if (key === 'escape') {
                if (this.isPaused) {
                    this.unpauseGame();
                } else {
                    this.pauseGame();
                }
                return;
            }
            
            // Não processar outros controles se o jogo estiver pausado
            if (this.isPaused) return;
            
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
        };

        this.handleKeyUp = (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = false;
            }
        };

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
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
            
            // Atualizar elemento visual
            projectile.element.style.left = `${projectile.x}px`;
            projectile.element.style.top = `${projectile.y}px`;
            
            // Criar hitbox aumentada para melhorar a detecção de colisão
            const projectileHitbox = {
                x: projectile.x - 10,
                y: projectile.y - 10,
                width: 30,
                height: 30
            };
            
            // Verificar colisão com inimigos
            let hitEnemy = false;
            
            for (let j = 0; j < this.enemies.length; j++) {
                const enemy = this.enemies[j];
                
                if (enemy.health > 0 && this.checkCollision(
                    projectileHitbox.x, projectileHitbox.y, projectileHitbox.width, projectileHitbox.height,
                    enemy.x, enemy.y, enemy.width, enemy.height
                )) {
                    // Calcular dano baseado no tipo de inimigo
                    const baseDamage = 20;
                    let damageReduction = 0;
                    
                    // Aplicar redução de dano baseado no tipo
                    switch(enemy.type) {
                        case 'armored':
                            damageReduction = 0.3; // 30% redução
                            break;
                        case 'boss':
                            damageReduction = 0.5; // 50% redução
                            break;
                    }
                    
                    // Calcular dano final
                    const actualDamage = Math.floor(baseDamage * (1 - damageReduction));
                    
                    // Subtrair vida do inimigo
                    enemy.health -= actualDamage;
                    
                    // Atualizar barra de vida
                    const healthPercentage = (enemy.health / enemy.maxHealth) * 100;
                    const healthFill = enemy.element.querySelector('.enemy-health-fill');
                    if (healthFill) {
                        healthFill.style.width = `${Math.max(0, healthPercentage)}%`;
                    }
                    
                    // Mostrar número de dano
                    this.showDamageNumber(actualDamage, enemy.x + enemy.width / 2, enemy.y);
                    
                    // Criar efeito de explosão do projétil
                    const explosion = document.createElement('div');
                    explosion.className = 'explosion';
                    explosion.style.left = `${projectile.x - 10}px`;
                    explosion.style.top = `${projectile.y - 10}px`;
                    this.gameContainer.appendChild(explosion);
                    
                    setTimeout(() => {
                        if (explosion.parentNode === this.gameContainer) {
                            this.gameContainer.removeChild(explosion);
                        }
                    }, 300);
                    
                    // Verificar se o inimigo foi derrotado
                    if (enemy.health <= 0) {
                        // Adicionar pontos
                        this.score += enemy.points;
                        this.updateHUD();
                        
                        // Remover inimigo
                        enemy.element.classList.add('explosion');
                        setTimeout(() => {
                            if (enemy.element.parentNode === this.gameContainer) {
                                this.gameContainer.removeChild(enemy.element);
                            }
                        }, 300);
                        
                        // Atualizar contagem de inimigos restantes
                        this.remainingEnemies--;
                        this.updateProgress();
                        
                        // Verificar se todos os inimigos foram derrotados
                        if (this.remainingEnemies <= 0) {
                            alert('Fase concluída! Todos os inimigos foram derrotados.');
                            this.changeMap(this.currentMapIndex + 1, 'right');
                        }
                    }
                    
                    // Remover projétil
                    this.projectiles.splice(i, 1);
                    this.gameContainer.removeChild(projectile.element);
                    hitEnemy = true;
                    break;
                }
            }
            
            // Se o projétil não atingiu um inimigo, verificar limites da tela
            if (!hitEnemy) {
                if (
                    projectile.x < 0 || 
                    projectile.x > 800 || 
                    projectile.y < 0 || 
                    projectile.y > 600
                ) {
                    this.projectiles.splice(i, 1);
                    this.gameContainer.removeChild(projectile.element);
                }
            }
        }
    }

    showDamageNumber(damage, x, y) {
        const damageElement = document.createElement('div');
        damageElement.className = 'damage-number';
        damageElement.textContent = damage;
        damageElement.style.left = `${x}px`;
        damageElement.style.top = `${y}px`;
        this.gameContainer.appendChild(damageElement);
        
        // Remover após a animação
        setTimeout(() => damageElement.remove(), 800);
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
        const currentTime = Date.now();
        
        // Verificar colisão com inimigos apenas se o jogador não estiver em período de invencibilidade
        if (currentTime - this.lastDamageTime < this.damageInvincibilityTime) {
            return;
        }
        
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            
            if (enemy.health > 0) {
                // Ajustar área de colisão para ser um pouco menor que o tamanho visual do inimigo
                // Isso torna a colisão mais justa para o jogador
                const collisionAdjustment = enemy.type === 'boss' ? 10 : 5;
                
                if (this.checkCollision(
                    this.playerPos.x, this.playerPos.y, 40, 40,
                    enemy.x + collisionAdjustment, enemy.y + collisionAdjustment, 
                    enemy.width - (collisionAdjustment * 2), enemy.height - (collisionAdjustment * 2)
                )) {
                    // Calcular dano baseado no tipo do inimigo
                    let damage = enemy.damage;
                    
                    // Chefes causam dano extra quando estão pulando
                    if (enemy.type === 'boss' && enemy.isJumping) {
                        damage *= 1.5;
                    }
                    
                    // Inimigos perseguindo causam um pouco mais de dano
                    if (enemy.isChasing) {
                        damage *= 1.2;
                    }
                    
                    // Reduzir vida do jogador
                    this.health -= Math.floor(damage);
                    this.lastDamageTime = currentTime;
                    
                    // Efeito visual de dano
                    this.player.classList.add('damaged');
                    setTimeout(() => {
                        this.player.classList.remove('damaged');
                    }, 200);
                    
                    // Knockback
                    const knockbackDirection = this.playerPos.x < enemy.x ? -1 : 1;
                    this.playerPos.x += knockbackDirection * 50;
                    
                    // Atualizar HUD
                    this.updateHUD();
                    
                    // Verificar game over
                    if (this.health <= 0) {
                        this.gameOver();
                    }
                }
            }
        }
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

        // Atualizar inimigos
        this.enemies.forEach(enemy => {
            if (enemy.health > 0) {
                // Comportamento de movimento específico para cada tipo de inimigo
                switch (enemy.movementType) {
                    case 'patrol':
                        this.updatePatrolEnemy(enemy);
                        break;
                    case 'chase':
                        this.updateChaseEnemy(enemy);
                        break;
                    case 'complex':
                        this.updateComplexEnemy(enemy);
                        break;
                }
                
                // Atualizar posição do elemento inimigo
                enemy.element.style.left = `${enemy.x}px`;
                enemy.element.style.top = `${enemy.y}px`;
                
                // Atualizar direção do inimigo (virado para esquerda ou direita)
                if (enemy.facingLeft) {
                    enemy.element.style.transform = 'scaleX(-1)';
                } else {
                    enemy.element.style.transform = 'scaleX(1)';
                }
            }
        });
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
        if (!this.isPaused) {
            this.update();
        }
        requestAnimationFrame(() => this.gameLoop());
    }

    createGameOverScreen() {
        const gameOverScreen = document.createElement('div');
        gameOverScreen.className = 'game-over-screen';
        
        const gameOverTitle = document.createElement('div');
        gameOverTitle.className = 'game-over-title';
        gameOverTitle.textContent = 'Game Over';
        
        const gameOverScore = document.createElement('div');
        gameOverScore.className = 'game-over-score';
        gameOverScore.textContent = `Pontuação Final: ${this.score}`;
        
        const restartButton = document.createElement('button');
        restartButton.className = 'restart-button';
        restartButton.textContent = 'Jogar Novamente';
        
        gameOverScreen.appendChild(gameOverTitle);
        gameOverScreen.appendChild(gameOverScore);
        gameOverScreen.appendChild(restartButton);
        
        this.gameContainer.appendChild(gameOverScreen);
        
        restartButton.addEventListener('click', () => {
            this.restartGame();
        });
    }

    restartGame() {
        // Limpar o container do jogo
        while (this.gameContainer.firstChild) {
            this.gameContainer.firstChild.remove();
        }
        
        // Resetar estado do jogo
        this.isPaused = false;
        this.projectiles = [];
        this.lastDamageTime = 0;
        
        // Remover todos os event listeners antigos
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        // Reiniciar o jogo
        this.initializeGame();
    }

    gameOver() {
        // Não usar isPaused aqui, apenas parar as animações
        this.gameContainer.classList.add('paused');
        
        // Pausar todas as animações existentes
        const animatedElements = this.gameContainer.querySelectorAll('.enemy, .item, .projectile, .explosion');
        animatedElements.forEach(element => {
            element.style.animationPlayState = 'paused';
        });
        
        this.createGameOverScreen();
    }

    // Método para movimento de patrulha (básico)
    updatePatrolEnemy(enemy) {
        // Adicionar classe de animação para patrulha
        enemy.element.classList.add('patrol');
        
        // Mudar direção ao atingir limites da patrulha
        if (enemy.x >= enemy.initialX + enemy.patrolDistance) {
            enemy.direction = -1;
            enemy.facingLeft = true;
        } else if (enemy.x <= enemy.initialX) {
            enemy.direction = 1;
            enemy.facingLeft = false;
        }
        
        // Mover inimigo na direção atual
        enemy.x += enemy.speed * enemy.direction;
    }

    // Método para movimento de perseguição (blindado)
    updateChaseEnemy(enemy) {
        // Verificar se o jogador está próximo (range de detecção)
        const detectionRange = 250;
        const minDistance = 20;
        const dx = this.playerPos.x - enemy.x;
        const dy = this.playerPos.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < detectionRange && distance > minDistance) {
            // Perseguir jogador
            enemy.isChasing = true;
            enemy.element.classList.add('chasing');
            enemy.element.classList.remove('patrol');
            
            // Normalizar vetor de direção para movimento
            const length = Math.sqrt(dx * dx + dy * dy);
            const ndx = dx / length;
            const ndy = dy / length;
            
            // Atualizar posição
            enemy.x += ndx * enemy.speed;
            enemy.y += ndy * enemy.speed;
            
            // Atualizar direção
            enemy.facingLeft = dx < 0;
        } else {
            // Voltar ao comportamento de patrulha quando o jogador estiver longe
            enemy.isChasing = false;
            enemy.element.classList.remove('chasing');
            enemy.element.classList.add('patrol');
            this.updatePatrolEnemy(enemy);
        }
    }

    // Método para movimento complexo (chefe)
    updateComplexEnemy(enemy) {
        // Incrementar temporizador de salto
        enemy.jumpTimer++;
        
        // Verificar distância do jogador
        const dx = this.playerPos.x - enemy.x;
        const dy = this.playerPos.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const detectionRange = 300;
        
        if (distance < detectionRange) {
            // Ativar modo de perseguição
            enemy.isChasing = true;
            enemy.element.classList.add('chasing');
            enemy.element.classList.remove('patrol');
            
            // Decidir ação com base na distância e temporizador
            if (distance < 150 && enemy.jumpTimer > 100 && !enemy.isJumping) {
                // Realizar salto para atacar o jogador
                enemy.isJumping = true;
                enemy.jumpVelocity = -10; // Velocidade inicial do salto (para cima)
                enemy.jumpTimer = 0;
                enemy.element.classList.add('jumping');
            } else if (enemy.isJumping) {
                // Atualizar salto
                enemy.jumpVelocity += 0.5; // Gravidade
                enemy.y += enemy.jumpVelocity;
                
                // Verificar aterrissagem
                if (enemy.y >= enemy.initialY) {
                    enemy.y = enemy.initialY;
                    enemy.isJumping = false;
                    enemy.element.classList.remove('jumping');
                }
            } else {
                // Movimento horizontal em direção ao jogador
                const moveSpeed = enemy.speed * 0.7; // Movimento mais lento que o normal
                
                // Normalizar movimento horizontal
                if (Math.abs(dx) > 10) { // Pequena tolerância para evitar tremulação
                    enemy.x += (dx > 0 ? 1 : -1) * moveSpeed;
                    enemy.facingLeft = dx < 0;
                }
            }
        } else {
            // Voltar ao comportamento de patrulha
            enemy.isChasing = false;
            enemy.element.classList.remove('chasing');
            enemy.element.classList.add('patrol');
            this.updatePatrolEnemy(enemy);
        }
    }

    updateProgress() {
        // Verificar se existe uma barra de progresso
        let progressContainer = document.querySelector('.progress-container');
        
        // Criar a barra de progresso se não existir
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            const progressText = document.createElement('div');
            progressText.className = 'progress-text';
            
            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(progressText);
            this.gameContainer.appendChild(progressContainer);
        }
        
        // Atualizar a barra de progresso
        const progressBar = progressContainer.querySelector('.progress-bar');
        const progressText = progressContainer.querySelector('.progress-text');
        
        if (this.totalEnemies > 0) {
            const percentage = (this.remainingEnemies / this.totalEnemies) * 100;
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = `Inimigos: ${this.remainingEnemies}/${this.totalEnemies}`;
        } else {
            progressBar.style.width = '100%';
            progressText.textContent = 'Sem inimigos';
        }
    }
}

// Iniciar o jogo quando a página carregar
window.addEventListener('load', () => {
    new Game();
}); 