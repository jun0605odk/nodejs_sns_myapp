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
    var sns_user_name  = req.cookies.sns_user_name;
    var sns_user_email = req.cookies.sns_user_email;
  }else{
    var sns_user_name  = "ゲスト";
    var sns_user_email = "";
  };
  var default_data = {
    home_url:       home_url,
    login_url:      home_url + '/log-in',
    signup_url:     home_url + '/sign-up',
    make_room_url:  home_url + '/room/make',
    login_status:   "こんにちは " + sns_user_name + " さん",
    sns_user_name:  sns_user_name,
    sns_user_email: sns_user_email
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
  encode: encodeURI, 
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
  default_data = make_default_data(req);
  res.render('sign-up', default_data);
});

app.post('/sign-up-done', function(req, res) {
  console.log('receiving data ...');
  console.log('body is ',req.body);
  var post_req = req;
  var post_res = res;

  const query = {
    text: 'INSERT INTO member (name, email, tel, gender, password) VALUES($1, $2, $3, $4, $5)',
    values: [req.body.name, req.body.email, req.body.tel, req.body.gender, req.body.pass],
  }
  
  conected_client.query(query)
    .then(res => {
      console.log(res)
      post_res.cookie('sns_user_name', post_req.body.name, cookie_obj)
      post_res.cookie('sns_user_email', post_req.body.email, cookie_obj)
    })
    .catch(e => {
      console.log("db関連のエラー")
      console.error(e.stack)
    });
  

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
  var post_req = req;
  var post_res = res;

  const query = {
    text: 'SELECT * FROM room'
  };

  conected_client.query(query)
    .then(res => {
      console.log(res);
      // if (res.rowCount!=0) {
        
      // } else {
        
      // }
      default_data = make_default_data(post_req);
      var room_data = {room_data:res.rows};
      default_data = { ...default_data, ...room_data };
      console.log("******************");
      console.log(default_data);
      console.log("******************");
      post_res.render('room-select', default_data);
    })
    .catch(e => console.error(e.stack))
  
});

app.get('/room/make', function(req, res){
  if(!req.cookies.sns_user_name){
    error_msg = "ゲストアカウントではルームの作成はできません。<br>ログインしてから再度このページにアクセスしてください";
    res.render('log-in', {home_url:home_url,error_msg:error_msg});
  }else{
    default_data = make_default_data(req);
    res.render('room-make', default_data);
  };
});

app.post('/room/make', function(req, res){
  console.log('/room/make');
  console.log('receiving data ...');
  console.log('body is ',req.body);
  var post_req = req;
  var post_res = res;

  //ToDo:sns_user_nameに値がなかった場合のエラー処理を追記
  //ToDo:作成予定のルーム名が既に作成されていた場合のエラー処理を追記
  const query = {
    text: 'INSERT INTO room (creater_name, creater_email, room_name, post_time) VALUES($1, $2, $3, $4)',
    values: [req.cookies.sns_user_name, req.cookies.sns_user_email, req.body.room_name, new Date()],
  };

  conected_client.query(query)
    .then(res => {
      console.log(res)
      post_res.redirect(home_url + '/room')
    })
    .catch(e => {
      console.error(e.stack)
      post_res.redirect(home_url + '/room/make')
    });

});

app.get('/room/name/:room_name', function(req, res){
  default_data = make_default_data(req);
  var room_data = {room_name:req.params.room_name};
  default_data = { ...default_data, ...room_data };
  console.log("******************");
  console.log(default_data);
  console.log("******************");
  res.render('room', default_data);
});



// ***********
// Websocket
// ***********

// chat
var chat = io.of('/chat');
chat.on('connection', function(socket){


  socket.on('client connection', function(data){
    socket.join(data.room);
    socket.client_name = data.user_name;
    console.log(data);
    chat.to(socket.id).emit('chat message from server', {chat_txt: 'あなたは ' + socket.client_name + ' として入室しました'});
    chat.in(data.room).emit('chat message from server', {chat_txt: socket.client_name + 'さんが入室しました'});


    var serch_date = new Date();
    serch_date.setDate(serch_date.getDate() - 7);
    const query = {
      text: 'SELECT * FROM chat where room=$1 AND post_time>=$2',
      values: [data.room, serch_date],
    };

    conected_client.query(query)
    .then(res => {
      console.log("*****old-chat-data*****");
      console.log(res);
      console.log("*****old-chat-data*****");
      if (res.rowCount!=0) {
        // console.log(res.rows[0].chat_txt);
        res.rows.forEach((elememt, index) => {
          console.log(`${index}: ${elememt.chat_txt}`);
          chat.to(socket.id).emit('old chat message from server', {chat_txt: `${elememt.chat_txt}` });
        });
      }
    })
    .catch(e => console.error(e.stack))

  });


  socket.on('chat message from client', function(data){

    const query = {
      text: 'INSERT INTO chat (user_name, user_email, room, chat_txt, post_time) VALUES($1, $2, $3, $4, $5)',
      values: [data.user_name, data.user_email, data.room, data.chat_txt, data.post_time],
    };

    conected_client.query(query)
    .then(res => {
      socket.client_name = data.user_name;
      console.log(data);
      chat.in(data.room).emit('chat message from server', data);
    })
    .catch(e => {
      console.error(e.stack)
    });
    
  });


});

// 広告
var ad = io.of('/ad');
ad.on('connection', function(socket){
  //socket.emit('chat message from server', 'Today : ' + new Date());
  socket.emit('chat message from server', "※　ここに広告が入る　※");
});


http.listen(port, function(){
  console.log('listening on *:' + port);
});