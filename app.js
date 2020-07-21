const bodyParser = require('body-parser') // body-parser
const cookieParser = require('cookie-parser')

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

// 変数
var home_url = "http://localhost:" + port;

function make_default_data(req) {
  if(req.cookies.sns_user_name){
    var sns_user_name = req.cookies.sns_user_name;
  }else{
    var sns_user_name = "ゲスト";
  };
  var default_data = {
    home_url:   home_url,
    login_url:  home_url + '/log-in',
    signup_url: home_url + '/sign-up',
    login_status: "こんにちは " + sns_user_name + " さん"
  };
  return default_data;
};

// db
var conected_client;
const db = require('./db/db');
db.client.connect((err, client) => {
  if (err) {
    console.log(err);
  } else {
    conected_client = client;
  }
});

// cookie
var expire_date = new Date();
expire_date.setDate(expire_date.getDate() + 7);

var cookie_obj = {
  expires: expire_date, 
  //maxAge: 60000*60*24*7,  //expiresとmaxAgeが両方設定されていた場合（かつ、ブラウザが両方認識できる場合）にはExpiresは無視される
  encode: String,
  //domain: '', 
  secure: false, 
  httpOnly: false, 
  //encode: encodeURIComponent, 
  //signed: false
};

app.set('views', './views');
app.set('view engine', 'ejs');

// middleware
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.use(express.static(__dirname + '/static')) //静的ファイルを使用する


//
// ルーティング
//
app.get('/db-test', function(req, res, next) {
  
  conected_client.query('SELECT * FROM member', (err, result) => {
    console.log(result.rows);
  });

  res.render('index', {
    title: 'hello express',
  });

});

app.get('/', function(req, res){
  default_data = make_default_data(req);
  res.render('home', default_data);
});


app.get('/sign-up', function(req, res){
  var data = {
    home_url:   home_url,
    login_url:  home_url + '/log-in',
    signup_url: home_url + '/sign-up',
  };
   res.render('sign-up', data);
});

app.post('/sign-up-done', function(req, res) {
  console.log('receiving data ...');
  console.log('body is ',req.body);

  const query = {
    text: 'INSERT INTO member (name, email, tel, gender, password) VALUES($1, $2, $3, $4, $5)',
    values: [req.body.name, req.body.email, req.body.tel, req.body.gender, req.body.pass],
  }
  
  conected_client.query(query)
    .then(res => console.log(res))
    .catch(e => console.error(e.stack))
  
  res.cookie('sns_user_name',  req.body.name,  cookie_obj );
  res.cookie('sns_user_email', req.body.email, cookie_obj );

  var data = {
    post_name:   req.body.name,
    post_email:  req.body.email,
    post_tel:    req.body.tel,
    post_gender: req.body.gender,
    post_pass:   req.body.pass,
  };
  res.render('sign-up-done', data);
});

// ログイン
app.get('/log-in', function(req, res){
  if(req.cookies.sns_user_name){
    var sns_user_name = req.cookies.sns_user_name;
    error_msg = "あなたは既に " + sns_user_name + "さんとしてログインしています。<br>異なるアカウントでログインしたい場合のみログイン操作を続行してください";
  };
  res.render('log-in', {home_url:home_url,error_msg:error_msg});
});

app.post('/log-in', function(req, res) {
  console.log('receiving data ...');
  console.log('body is ',req.body);
  var post_res = res;

  const query = {
    text: 'SELECT * FROM member where email=$1 AND password=$2',
    values: [req.body.email, req.body.pass],
  };

  conected_client.query(query)
    .then(res => {
      console.log(res);
      if (res.rowCount!=0) {
        post_res.cookie('sns_user_name',  res.rows[0].name,  cookie_obj );
        post_res.cookie('sns_user_email', res.rows[0].email, cookie_obj );
        console.log(res.rows[0].name);
        console.log(res.rows[0].email);
        //console.log(req.headers.cookie);
        //console.log(req.cookies.sns_user_name);
        post_res.redirect(home_url + '/room');
      } else {
        var error_msg = 'エラー<br>メールアドレスとパスワードが一致しません'
        post_res.render('log-in',  {home_url:home_url, error_msg:error_msg});
      }
    })
    .catch(e => console.error(e.stack))
    
  });

// room
app.get('/room', function(req, res){
  default_data = make_default_data(req);
  res.render('room-select', default_data);
});

app.get('/room-make', function(req, res){
  default_data = make_default_data(req);
  res.render('room-make', default_data);
});

app.get('/room/:room_name', function(req, res){
  var home_url = "http://localhost:" + port;
  res.render('room', {
    home_url:home_url,
    room_name:req.params.room_name
  });
});



// chat
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