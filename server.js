// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Phục vụ các file tĩnh trong cùng thư mục
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Trạng thái lưu trữ toàn cục trên server
let currentPlayers = {};
let currentQuizState = null;
let isRevealedGlobal = false;
let globalCorrectAns = '';

io.on('connection', (socket) => {
    console.log(`📡 Thiết bị kết nối mới: ${socket.id}`);

    // Gửi dữ liệu hiện tại ngay lập tức cho thiết bị mới vào để đồng bộ
    socket.emit('SYNC_DATA_FROM_SERVER', { players: currentPlayers, isRevealed: isRevealedGlobal, correctAns: globalCorrectAns });
    if (currentQuizState) socket.emit('START_QUIZ', currentQuizState);

    // Đồng bộ định kỳ hoặc cập nhật thủ công từ Admin Controller
    socket.on('ADMIN_SYNC_PLAYERS', (data) => {
        if (data.players) {
            currentPlayers = data.players;
            socket.broadcast.emit('SYNC_DATA_FROM_SERVER', { players: currentPlayers, isRevealed: isRevealedGlobal, correctAns: globalCorrectAns });
        }
    });

    // Admin phát đề câu hỏi mới
    socket.on('START_QUIZ', (data) => {
        currentQuizState = data;
        isRevealedGlobal = false;
        globalCorrectAns = '';
        
        // Reset trạng thái làm bài câu mới của toàn bộ người chơi trên Server
        for (let p in currentPlayers) {
            currentPlayers[p].answer = 'Chưa trả lời';
            currentPlayers[p].isLocked = false;
            currentPlayers[p].timeTaken = null;
            currentPlayers[p].calculatedScore = 0;
        }
        io.emit('START_QUIZ', data);
    });

    // Admin báo hết giờ câu hỏi
    socket.on('TIME_UP', (data) => {
        io.emit('TIME_UP', data);
    });

    // Admin bấm công bố đáp án đúng (SHOW ĐÁP ÁN)
    socket.on('COMMAND_DISPLAY_REVEAL', (data) => {
        isRevealedGlobal = true;
        globalCorrectAns = data.correctAns;
        if (data.players) currentPlayers = data.players;
        
        io.emit('COMMAND_DISPLAY_REVEAL', data);
    });

    // Thí sinh tham gia phòng và điền tên
    socket.on('PLAYER_JOIN', (data) => {
        if (data.name) {
            socket.playerName = data.name;
            if (!currentPlayers[data.name]) {
                currentPlayers[data.name] = { 
                    answer: 'Chưa trả lời', isLocked: false, timeTaken: null, calculatedScore: 0, isEliminated: false,
                    totalScore: '0.00', totalTime: '0.00'
                };
            }
            io.emit('SYNC_DATA_FROM_SERVER', { players: currentPlayers, isRevealed: isRevealedGlobal, correctAns: globalCorrectAns });
        }
    });

    // Thí sinh thao tác chọn/gõ/chốt đáp án
    socket.on('PLAYER_SUBMIT', (data) => {
        if (data.name && currentPlayers[data.name]) {
            currentPlayers[data.name].answer = data.answer;
            currentPlayers[data.name].isLocked = data.isLocked;
            currentPlayers[data.name].timeTaken = data.timeTaken;
            currentPlayers[data.name].calculatedScore = data.calculatedScore;
            
            io.emit('SYNC_DATA_FROM_SERVER', { players: currentPlayers, isRevealed: isRevealedGlobal, correctAns: globalCorrectAns });
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ Thiết bị thoát: ${socket.id} (${socket.playerName || 'Ẩn danh'})`);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 ROCKET QUIZ ONLINE SERVER ĐÃ HOẠT ĐỘNG!`);
    console.log(`🏠 Link chạy local: http://localhost:${PORT}`);
    console.log(`🌐 Máy con truy cập qua IP mạng LAN của máy chủ này, cổng ${PORT}`);
    console.log(`=======================================================`);
});