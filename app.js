var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

app.set('views', './views');
app.set('view engine', 'ejs');

// middleware
app.use(express.static(__dirname + '/static')) //静的ファイルを使用する

// ルーティング
var home_url = "http://localhost:" + port;

app.get('/', function(req, res){
  res.render('index', {home_url:home_url});
});

app.get('/sign-up', function(req, res){
  res.render('sign-up', {home_url:home_url});
});

app.get('/log-in', function(req, res){
  res.render('log-in', {home_url:home_url});
});

app.get('/room', function(req, res){
  res.render('room-select', {home_url:home_url});
});

app.get('/room-make', function(req, res){
  res.render('room-make', {home_url:home_url});
});

app.get('/room/:room_name', function(req, res){
  var home_url = "http://localhost:" + port;
  res.render('room', {
    home_url:home_url,
    room_name:req.params.room_name
  });
});


var chat = io.of('/chat');
chat.on('connection', function(socket){
  socket.on('chat message from client', function(data){
    socket.join(data.room);
    socket.client_name = data.name;
    //console.log(data.room); 
    //console.log(socket.client_name);
    //console.log(data.msg);
    chat.in(data.room).emit('chat message from server', socket.client_name + 'さんが入室しました');
    chat.in(data.room).emit('chat message from server', '[' + socket.client_name + '] : ' + data.msg);
  });
});

var ad = io.of('/ad');
ad.on('connection', function(socket){
  socket.emit('chat message from server', 'Today : ' + new Date());
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});