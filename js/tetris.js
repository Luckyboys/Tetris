(function () {
    "use strict";

    var COLS = 10;
    var ROWS = 20;
    var CELL = 30;

    var SHAPES = [
        [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[2, 2], [2, 2]],
        [[0, 3, 0], [3, 3, 3], [0, 0, 0]],
        [[0, 4, 4], [4, 4, 0], [0, 0, 0]],
        [[5, 5, 0], [0, 5, 5], [0, 0, 0]],
        [[6, 0, 0], [6, 6, 6], [0, 0, 0]],
        [[0, 0, 7], [7, 7, 7], [0, 0, 0]]
    ];

    var COLORS = [
        null,
        { fill: "#00e5ff", light: "#80f0ff", dark: "#0091a3", glow: "rgba(0,229,255,0.5)" },
        { fill: "#ffea00", light: "#fff566", dark: "#b8a800", glow: "rgba(255,234,0,0.5)" },
        { fill: "#aa00ff", light: "#d066ff", dark: "#7200b3", glow: "rgba(170,0,255,0.5)" },
        { fill: "#76ff03", light: "#b2ff66", dark: "#4a9900", glow: "rgba(118,255,3,0.5)" },
        { fill: "#ff1744", light: "#ff6680", dark: "#b3001e", glow: "rgba(255,23,68,0.5)" },
        { fill: "#2979ff", light: "#80abff", dark: "#0044cc", glow: "rgba(41,121,255,0.5)" },
        { fill: "#ff9100", light: "#ffb866", dark: "#cc6600", glow: "rgba(255,145,0,0.5)" }
    ];

    function Piece(type) {
        this.type = type;
        this.shape = SHAPES[type].map(function (r) { return r.slice(); });
        this.colorObj = COLORS[type + 1];
        this.color = this.colorObj.fill;
        this.x = Math.floor((COLS - this.shape[0].length) / 2);
        this.y = 0;
    }

    Piece.prototype.clone = function () {
        var p = new Piece(this.type);
        p.shape = this.shape.map(function (r) { return r.slice(); });
        p.x = this.x;
        p.y = this.y;
        return p;
    };

    function rotateCW(shape) {
        var n = shape.length;
        var r = [];
        for (var i = 0; i < n; i++) {
            r[i] = [];
            for (var j = 0; j < n; j++) {
                r[i][j] = shape[n - 1 - j][i];
            }
        }
        return r;
    }

    function Particle(x, y, color) {
        this.x = x;
        this.y = y;
        var angle = Math.random() * Math.PI * 2;
        var speed = 2 + Math.random() * 5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 2;
        this.color = color;
        this.life = 0.6 + Math.random() * 0.4;
        this.maxLife = this.life;
        this.size = 2 + Math.random() * 4;
    }

    Particle.prototype.update = function () {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.15;
        this.life -= 0.02;
    };

    Particle.prototype.alive = function () {
        return this.life > 0;
    };

    function Game(boardCanvas, nextCanvas, nextCanvasDesktop) {
        this.boardCanvas = boardCanvas;
        this.ctx = boardCanvas.getContext("2d");
        this.nextCanvas = nextCanvas;
        this.nextCtx = nextCanvas.getContext("2d");
        this.nextCanvasDesktop = nextCanvasDesktop;
        this.nextCtxDesktop = nextCanvasDesktop ? nextCanvasDesktop.getContext("2d") : null;

        boardCanvas.width = COLS * CELL;
        boardCanvas.height = ROWS * CELL;
        nextCanvas.width = 4 * CELL;
        nextCanvas.height = 4 * CELL;
        if (nextCanvasDesktop) {
            nextCanvasDesktop.width = 4 * CELL;
            nextCanvasDesktop.height = 4 * CELL;
        }

        this.board = [];
        this.current = null;
        this.next = null;
        this.bag = [];
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.running = false;
        this.paused = false;
        this.timer = null;
        this.dropInterval = 800;

        this.sound = (typeof SoundEngine === "function") ? new SoundEngine() : null;

        this.shakeOffset = { x: 0, y: 0 };
        this.shakeIntensity = 0;
        this.particles = [];
        this.particleAnimId = null;

        this.initBoard();
        this.bindKeys();
    }

    Game.prototype.initBoard = function () {
        this.board = [];
        for (var y = 0; y < ROWS; y++) {
            this.board[y] = new Array(COLS).fill(0);
        }
    };

    Game.prototype.fillBag = function () {
        this.bag = [0, 1, 2, 3, 4, 5, 6];
        for (var i = this.bag.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = this.bag[i];
            this.bag[i] = this.bag[j];
            this.bag[j] = tmp;
        }
    };

    Game.prototype.nextFromBag = function () {
        if (this.bag.length === 0) {
            this.fillBag();
        }
        return this.bag.pop();
    };

    Game.prototype.spawnPiece = function () {
        this.current = this.next || new Piece(this.nextFromBag());
        this.next = new Piece(this.nextFromBag());
    };

    Game.prototype.valid = function (piece) {
        for (var y = 0; y < piece.shape.length; y++) {
            for (var x = 0; x < piece.shape[y].length; x++) {
                if (!piece.shape[y][x]) continue;
                var bx = piece.x + x;
                var by = piece.y + y;
                if (bx < 0 || bx >= COLS || by >= ROWS) return false;
                if (by >= 0 && this.board[by][bx]) return false;
            }
        }
        return true;
    };

    Game.prototype.lockPiece = function () {
        var p = this.current;
        for (var y = 0; y < p.shape.length; y++) {
            for (var x = 0; x < p.shape[y].length; x++) {
                if (!p.shape[y][x]) continue;
                var bx = p.x + x;
                var by = p.y + y;
                if (by < 0) {
                    this.gameOver();
                    return;
                }
                this.board[by][bx] = p.type + 1;
            }
        }
        this.clearLines();
        this.spawnPiece();
        if (!this.valid(this.current)) {
            this.gameOver();
        }
    };

    Game.prototype.clearLines = function () {
        var cleared = 0;
        var clearedRows = [];
        for (var y = ROWS - 1; y >= 0; y--) {
            if (this.board[y].every(function (c) { return c !== 0; })) {
                clearedRows.push(y);
                for (var x = 0; x < COLS; x++) {
                    var type = this.board[y][x];
                    var cx = x * CELL + CELL / 2;
                    var cy = y * CELL + CELL / 2;
                    for (var i = 0; i < 3; i++) {
                        this.particles.push(new Particle(cx, cy, COLORS[type].light));
                    }
                }
                this.board.splice(y, 1);
                this.board.unshift(new Array(COLS).fill(0));
                cleared++;
                y++;
            }
        }
        if (cleared > 0) {
            this.startParticleAnimation();
            this.startShake(cleared * 3, 150 + cleared * 80);
            var points = [0, 100, 300, 500, 800];
            this.score += points[cleared] * this.level;
            this.lines += cleared;
            var prevLevel = this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(50, 800 - (this.level - 1) * 70);
            this.updateUI();

            if (cleared === 4) {
                this._sfx("tetris");
            } else if (cleared === 3) {
                this._sfx("clear3");
            } else if (cleared === 2) {
                this._sfx("clear2");
            } else {
                this._sfx("clear1");
            }
            if (this.level > prevLevel) {
                if (this.sound) {
                    this.sound.setBGMBpm(this._levelToBpm(this.level));
                }
                var self = this;
                setTimeout(function () { self._sfx("levelUp"); }, 400);
            }
        }
    };

    Game.prototype.startShake = function (intensity, duration) {
        this.shakeIntensity = Math.min(intensity, 14);
        var self = this;
        var startTime = Date.now();
        function shakeFrame() {
            var elapsed = Date.now() - startTime;
            if (elapsed > duration) {
                self.shakeIntensity = 0;
                self.shakeOffset.x = 0;
                self.shakeOffset.y = 0;
                self.draw();
                return;
            }
            var decay = 1 - elapsed / duration;
            var currentIntensity = self.shakeIntensity * decay;
            self.shakeOffset.x = (Math.random() - 0.5) * currentIntensity * 2;
            self.shakeOffset.y = (Math.random() - 0.5) * currentIntensity * 2;
            self.draw();
            requestAnimationFrame(shakeFrame);
        }
        requestAnimationFrame(shakeFrame);
    };

    Game.prototype.startParticleAnimation = function () {
        if (this.particleAnimId) return;
        var self = this;
        function animFrame() {
            var alive = false;
            for (var i = 0; i < self.particles.length; i++) {
                self.particles[i].update();
                if (self.particles[i].alive()) alive = true;
            }
            self.particles = self.particles.filter(function (p) { return p.alive(); });
            self.draw();
            if (alive) {
                self.particleAnimId = requestAnimationFrame(animFrame);
            } else {
                self.particleAnimId = null;
            }
        }
        this.particleAnimId = requestAnimationFrame(animFrame);
    };

    Game.prototype._sfx = function (name) {
        if (this.sound) this.sound.play(name);
    };

    Game.prototype.moveLeft = function () {
        this.current.x--;
        if (!this.valid(this.current)) {
            this.current.x++;
        } else {
            this._sfx("move");
        }
    };

    Game.prototype.moveRight = function () {
        this.current.x++;
        if (!this.valid(this.current)) {
            this.current.x--;
        } else {
            this._sfx("move");
        }
    };

    Game.prototype.moveDown = function () {
        this.current.y++;
        if (!this.valid(this.current)) {
            this.current.y--;
            this._sfx("land");
            this.lockPiece();
        }
    };

    Game.prototype.rotate = function () {
        var rotated = rotateCW(this.current.shape);
        var old = this.current.shape;
        this.current.shape = rotated;
        if (!this.valid(this.current)) {
            this.current.x--;
            if (!this.valid(this.current)) {
                this.current.x += 2;
                if (!this.valid(this.current)) {
                    this.current.x--;
                    this.current.shape = old;
                    return;
                }
            }
        }
        this._sfx("rotate");
    };

    Game.prototype.hardDrop = function () {
        while (this.valid(this.current)) {
            this.current.y++;
        }
        this.current.y--;
        this._sfx("hardDrop");
        this.lockPiece();
    };

    Game.prototype.drawCell = function (ctx, x, y, colorObj, alpha) {
        var px = x * CELL;
        var py = y * CELL;
        var margin = 2;
        var r = 3;

        ctx.save();
        if (alpha !== undefined) {
            ctx.globalAlpha = alpha;
        }

        ctx.shadowColor = colorObj.glow;
        ctx.shadowBlur = 6;
        ctx.fillStyle = colorObj.fill;
        ctx.beginPath();
        ctx.moveTo(px + margin + r, py + margin);
        ctx.lineTo(px + CELL - margin - r, py + margin);
        ctx.arcTo(px + CELL - margin, py + margin, px + CELL - margin, py + margin + r, r);
        ctx.lineTo(px + CELL - margin, py + CELL - margin - r);
        ctx.arcTo(px + CELL - margin, py + CELL - margin, px + CELL - margin - r, py + CELL - margin, r);
        ctx.lineTo(px + margin + r, py + CELL - margin);
        ctx.arcTo(px + margin, py + CELL - margin, px + margin, py + CELL - margin - r, r);
        ctx.lineTo(px + margin, py + margin + r);
        ctx.arcTo(px + margin, py + margin, px + margin + r, py + margin, r);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        var hlGrad = ctx.createLinearGradient(px, py, px, py + CELL);
        hlGrad.addColorStop(0, "rgba(255,255,255,0.28)");
        hlGrad.addColorStop(0.4, "rgba(255,255,255,0.06)");
        hlGrad.addColorStop(0.6, "rgba(0,0,0,0.0)");
        hlGrad.addColorStop(1, "rgba(0,0,0,0.3)");
        ctx.fillStyle = hlGrad;
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(px + margin + 2, py + margin + 1, CELL - margin * 2 - 4, 5);

        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(px + margin + 1, py + margin + 2, 5, CELL - margin * 2 - 4);

        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    };

    Game.prototype.drawBoard = function () {
        var ctx = this.ctx;
        var self = this;

        var bgGrad = ctx.createLinearGradient(0, 0, 0, ROWS * CELL);
        bgGrad.addColorStop(0, "#0a0a1a");
        bgGrad.addColorStop(1, "#0f1123");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

        ctx.save();
        ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

        for (var y = 0; y < ROWS; y++) {
            for (var x = 0; x < COLS; x++) {
                if (this.board[y][x]) {
                    this.drawCell(ctx, x, y, COLORS[this.board[y][x]]);
                }
            }
        }

        ctx.strokeStyle = "rgba(80,80,140,0.18)";
        ctx.lineWidth = 0.5;
        ctx.shadowColor = "rgba(80,80,200,0.15)";
        ctx.shadowBlur = 2;
        for (var y1 = 0; y1 <= ROWS; y1++) {
            ctx.beginPath();
            ctx.moveTo(0, y1 * CELL);
            ctx.lineTo(COLS * CELL, y1 * CELL);
            ctx.stroke();
        }
        for (var x1 = 0; x1 <= COLS; x1++) {
            ctx.beginPath();
            ctx.moveTo(x1 * CELL, 0);
            ctx.lineTo(x1 * CELL, ROWS * CELL);
            ctx.stroke();
        }
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        if (this.current) {
            var p = this.current;

            var ghost = p.clone();
            while (ghost.y < ROWS) {
                ghost.y++;
                if (!this.valid(ghost)) {
                    ghost.y--;
                    break;
                }
            }
            for (var y3 = 0; y3 < ghost.shape.length; y3++) {
                for (var x3 = 0; x3 < ghost.shape[y3].length; x3++) {
                    if (ghost.shape[y3][x3]) {
                        var gx = (ghost.x + x3) * CELL;
                        var gy = (ghost.y + y3) * CELL;
                        ctx.fillStyle = p.colorObj.glow.replace("0.5", "0.12");
                        ctx.fillRect(gx + 2, gy + 2, CELL - 4, CELL - 4);
                        ctx.strokeStyle = p.colorObj.glow.replace("0.5", "0.25");
                        ctx.lineWidth = 1;
                        ctx.strokeRect(gx + 2, gy + 2, CELL - 4, CELL - 4);
                    }
                }
            }

            for (var y2 = 0; y2 < p.shape.length; y2++) {
                for (var x2 = 0; x2 < p.shape[y2].length; x2++) {
                    if (p.shape[y2][x2]) {
                        this.drawCell(ctx, p.x + x2, p.y + y2, p.colorObj);
                    }
                }
            }
        }

        for (var i = 0; i < this.particles.length; i++) {
            var pt = this.particles[i];
            var alpha = pt.life / pt.maxLife;
            ctx.fillStyle = pt.color;
            ctx.globalAlpha = alpha;
            ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        }
        ctx.globalAlpha = 1;

        ctx.restore();
    };

    Game.prototype.drawNext = function () {
        var W = 4 * CELL;
        var H = 4 * CELL;
        var ctx = this.nextCtx;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#0a0a1a";
        ctx.fillRect(0, 0, W, H);

        if (this.nextCtxDesktop) {
            this.nextCtxDesktop.clearRect(0, 0, W, H);
            this.nextCtxDesktop.fillStyle = "#0a0a1a";
            this.nextCtxDesktop.fillRect(0, 0, W, H);
        }

        if (!this.next) return;
        var shape = this.next.shape;
        var colorObj = this.next.colorObj;
        var size = shape.length;

        var minX = size, minY = size, maxX = -1, maxY = -1;
        for (var yy = 0; yy < size; yy++) {
            for (var xx = 0; xx < size; xx++) {
                if (shape[yy][xx]) {
                    if (xx < minX) minX = xx;
                    if (yy < minY) minY = yy;
                    if (xx > maxX) maxX = xx;
                    if (yy > maxY) maxY = yy;
                }
            }
        }
        if (maxX < 0) return;

        var pieceW = (maxX - minX + 1) * CELL;
        var pieceH = (maxY - minY + 1) * CELL;
        var pxOffset = (W - pieceW) / 2 - minX * CELL;
        var pyOffset = (H - pieceH) / 2 - minY * CELL;

        var self = this;
        function drawTo(targetCtx) {
            targetCtx.save();
            targetCtx.translate(pxOffset, pyOffset);
            for (var y = 0; y < size; y++) {
                for (var x = 0; x < size; x++) {
                    if (shape[y][x]) {
                        self.drawCell(targetCtx, x, y, colorObj);
                    }
                }
            }
            targetCtx.restore();
        }

        drawTo(ctx);
        if (this.nextCtxDesktop) {
            drawTo(this.nextCtxDesktop);
        }
    };

    Game.prototype.draw = function () {
        this.drawBoard();
        this.drawNext();
    };

    Game.prototype.updateUI = function () {
        var score = this.score;
        var lines = this.lines;
        var level = this.level;
        var ids = [
            ["score", score], ["lines", lines], ["level", level],
            ["scoreD", score], ["linesD", lines], ["levelD", level]
        ];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i][0]);
            if (el) el.textContent = ids[i][1];
        }
    };

    Game.prototype.tick = function () {
        if (!this.running || this.paused) return;
        var self = this;
        this.moveDown();
        this.draw();
        this.updateTimer();
    };

    Game.prototype.updateTimer = function () {
        if (this.timer) clearInterval(this.timer);
        var self = this;
        this.timer = setInterval(function () { self.tick(); }, this.dropInterval);
    };

    Game.prototype.start = function () {
        this.initBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = 800;
        this.running = true;
        this.paused = false;
        this.current = null;
        this.next = null;
        this.bag = [];
        this.particles = [];
        this.shakeOffset = { x: 0, y: 0 };
        this.shakeIntensity = 0;
        this.updateUI();
        this.spawnPiece();
        this.draw();
        this.updateTimer();
        document.getElementById("startBtn").textContent = "重新开始";
        document.getElementById("startBtnD").textContent = "重新开始";
        if (this.sound) {
            this.sound.setBGMBpm(this._levelToBpm(this.level));
        }
        this._sfx("start");
        if (this.sound) this.sound.startBGM();
    };

    Game.prototype._levelToBpm = function (level) {
        return Math.min(160, 100 + (level - 1) * 8);
    };

    Game.prototype.pauseToggle = function () {
        if (!this.running) return;
        this.paused = !this.paused;
        if (this.paused) {
            clearInterval(this.timer);
            this._sfx("pause");
            if (this.sound) this.sound.stopBGM();
        } else {
            this.updateTimer();
            this._sfx("resume");
            if (this.sound) this.sound.startBGM();
        }
        this.draw();
    };

    Game.prototype.gameOver = function () {
        this.running = false;
        clearInterval(this.timer);
        if (this.sound) this.sound.stopBGM();
        this._sfx("gameOver");
        document.getElementById("finalScore").textContent = this.score;
        document.getElementById("gameOver").classList.remove("hidden");
    };

    Game.prototype.bindKeys = function () {
        var self = this;
        document.addEventListener("keydown", function (e) {
            if (!self.running) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self.restart();
                }
                return;
            }
            if (e.key === "p" || e.key === "P") {
                e.preventDefault();
                self.pauseToggle();
                return;
            }
            if (self.paused) return;
            switch (e.key) {
                case "ArrowLeft":
                case "a":
                    e.preventDefault();
                    self.moveLeft();
                    break;
                case "ArrowRight":
                case "d":
                    e.preventDefault();
                    self.moveRight();
                    break;
                case "ArrowDown":
                case "s":
                    e.preventDefault();
                    self.moveDown();
                    break;
                case "ArrowUp":
                case "w":
                    e.preventDefault();
                    self.rotate();
                    break;
                case " ":
                    e.preventDefault();
                    self.hardDrop();
                    break;
            }
            self.draw();
            if (self.paused) return;
            if (e.key === "ArrowDown" || e.key === "s") {
                self.updateTimer();
            }
        });

        var btns = document.querySelectorAll(".touch-btn");
        for (var k = 0; k < btns.length; k++) {
            btns[k].addEventListener("touchstart", function (e) {
                e.preventDefault();
                self.handleTouchAction(this.dataset.action);
            });
            btns[k].addEventListener("mousedown", function (e) {
                e.preventDefault();
                self.handleTouchAction(this.dataset.action);
            });
        }
    };

    Game.prototype.handleTouchAction = function (action) {
        if (action === "pause") {
            this.pauseToggle();
            return;
        }
        if (!this.running) {
            if (action === "hardDrop") {
                this.restart();
            }
            return;
        }
        if (this.paused) return;
        switch (action) {
            case "left":
                this.moveLeft();
                break;
            case "right":
                this.moveRight();
                break;
            case "down":
                this.moveDown();
                this.updateTimer();
                break;
            case "rotate":
                this.rotate();
                break;
            case "hardDrop":
                this.hardDrop();
                break;
        }
        this.draw();
    };

    Game.prototype.restart = function () {
        document.getElementById("gameOver").classList.add("hidden");
        this.start();
    };

    var boardCanvas = document.getElementById("boardCanvas");
    var nextCanvas = document.getElementById("nextCanvas");
    var nextCanvasDesktop = document.getElementById("nextCanvasDesktop");
    var game = new Game(boardCanvas, nextCanvas, nextCanvasDesktop);

    document.getElementById("startBtn").addEventListener("click", function () {
        game.start();
    });
    document.getElementById("startBtnD").addEventListener("click", function () {
        game.start();
    });
    document.getElementById("restartBtn").addEventListener("click", function () {
        game.restart();
    });

    function updateMuteUI(muted) {
        var labelMobile = muted ? "🔇" : "🔊";
        var labelDesktop = muted ? "🔇 音效关" : "🔊 音效开";
        var mob = document.getElementById("muteBtn");
        var desk = document.getElementById("muteBtnD");
        if (mob) {
            mob.textContent = labelMobile;
            mob.classList.toggle("muted", muted);
        }
        if (desk) {
            desk.textContent = labelDesktop;
            desk.classList.toggle("muted", muted);
        }
    }

    function bindMuteButton(id) {
        var btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            if (!game.sound) return;
            var muted = game.sound.toggleMute();
            updateMuteUI(muted);
        });
    }
    bindMuteButton("muteBtn");
    bindMuteButton("muteBtnD");

    game.draw();
})();
