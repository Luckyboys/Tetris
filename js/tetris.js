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
        "#00f0f0",
        "#f0f000",
        "#a000f0",
        "#00f000",
        "#f00000",
        "#0000f0",
        "#f0a000"
    ];

    function Piece(type) {
        this.type = type;
        this.shape = SHAPES[type].map(function (r) { return r.slice(); });
        this.color = COLORS[type + 1];
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

    function Game(boardCanvas, nextCanvas) {
        this.boardCanvas = boardCanvas;
        this.ctx = boardCanvas.getContext("2d");
        this.nextCanvas = nextCanvas;
        this.nextCtx = nextCanvas.getContext("2d");

        boardCanvas.width = COLS * CELL;
        boardCanvas.height = ROWS * CELL;
        nextCanvas.width = 4 * CELL;
        nextCanvas.height = 4 * CELL;

        this.board = [];
        this.current = null;
        this.next = null;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.running = false;
        this.paused = false;
        this.timer = null;
        this.dropInterval = 800;

        this.initBoard();
        this.bindKeys();
    }

    Game.prototype.initBoard = function () {
        this.board = [];
        for (var y = 0; y < ROWS; y++) {
            this.board[y] = new Array(COLS).fill(0);
        }
    };

    Game.prototype.spawnPiece = function () {
        this.current = this.next || new Piece(Math.floor(Math.random() * 7));
        this.next = new Piece(Math.floor(Math.random() * 7));
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
        for (var y = ROWS - 1; y >= 0; y--) {
            if (this.board[y].every(function (c) { return c !== 0; })) {
                this.board.splice(y, 1);
                this.board.unshift(new Array(COLS).fill(0));
                cleared++;
                y++;
            }
        }
        if (cleared > 0) {
            var points = [0, 100, 300, 500, 800];
            this.score += points[cleared] * this.level;
            this.lines += cleared;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(50, 800 - (this.level - 1) * 70);
            this.updateUI();
        }
    };

    Game.prototype.moveLeft = function () {
        this.current.x--;
        if (!this.valid(this.current)) this.current.x++;
    };

    Game.prototype.moveRight = function () {
        this.current.x++;
        if (!this.valid(this.current)) this.current.x--;
    };

    Game.prototype.moveDown = function () {
        this.current.y++;
        if (!this.valid(this.current)) {
            this.current.y--;
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
                }
            }
        }
    };

    Game.prototype.hardDrop = function () {
        while (this.valid(this.current)) {
            this.current.y++;
        }
        this.current.y--;
        this.lockPiece();
    };

    Game.prototype.drawBoard = function () {
        var ctx = this.ctx;
        ctx.fillStyle = "#0f0f1a";
        ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

        for (var y = 0; y < ROWS; y++) {
            for (var x = 0; x < COLS; x++) {
                if (this.board[y][x]) {
                    this.drawCell(ctx, x, y, COLORS[this.board[y][x]]);
                }
            }
        }

        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth = 0.5;
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

        if (this.current) {
            var p = this.current;
            for (var y2 = 0; y2 < p.shape.length; y2++) {
                for (var x2 = 0; x2 < p.shape[y2].length; x2++) {
                    if (p.shape[y2][x2]) {
                        this.drawCell(ctx, p.x + x2, p.y + y2, p.color);
                    }
                }
            }

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
                        ctx.fillStyle = "rgba(255,255,255,0.08)";
                        var gx = (ghost.x + x3) * CELL;
                        var gy = (ghost.y + y3) * CELL;
                        ctx.fillRect(gx + 1, gy + 1, CELL - 2, CELL - 2);
                    }
                }
            }
        }
    };

    Game.prototype.drawCell = function (ctx, x, y, color) {
        var px = x * CELL;
        var py = y * CELL;
        ctx.fillStyle = color;
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(px + 1, py + 1, CELL - 2, 4);
        ctx.fillRect(px + 1, py + 1, 4, CELL - 2);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(px + 1, py + CELL - 5, CELL - 2, 4);
        ctx.fillRect(px + CELL - 5, py + 1, 4, CELL - 2);
    };

    Game.prototype.drawNext = function () {
        var ctx = this.nextCtx;
        ctx.fillStyle = "#0f0f1a";
        ctx.fillRect(0, 0, 4 * CELL, 4 * CELL);

        if (!this.next) return;
        var shape = this.next.shape;
        var color = this.next.color;
        var size = shape.length;
        var offsetX = Math.floor((4 - size) / 2);
        var offsetY = Math.floor((4 - size) / 2);

        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++) {
                if (shape[y][x]) {
                    this.drawCell(ctx, offsetX + x, offsetY + y, color);
                }
            }
        }
    };

    Game.prototype.draw = function () {
        this.drawBoard();
        this.drawNext();
    };

    Game.prototype.updateUI = function () {
        document.getElementById("score").textContent = this.score;
        document.getElementById("lines").textContent = this.lines;
        document.getElementById("level").textContent = this.level;
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
        this.updateUI();
        this.spawnPiece();
        this.draw();
        this.updateTimer();
        document.getElementById("startBtn").textContent = "重新开始";
    };

    Game.prototype.pauseToggle = function () {
        if (!this.running) return;
        this.paused = !this.paused;
        if (this.paused) {
            clearInterval(this.timer);
        } else {
            this.updateTimer();
        }
        this.draw();
    };

    Game.prototype.gameOver = function () {
        this.running = false;
        clearInterval(this.timer);
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
    };

    Game.prototype.restart = function () {
        document.getElementById("gameOver").classList.add("hidden");
        this.start();
    };

    var boardCanvas = document.getElementById("boardCanvas");
    var nextCanvas = document.getElementById("nextCanvas");
    var game = new Game(boardCanvas, nextCanvas);

    document.getElementById("startBtn").addEventListener("click", function () {
        game.start();
    });
    document.getElementById("restartBtn").addEventListener("click", function () {
        game.restart();
    });

    game.draw();
})();
