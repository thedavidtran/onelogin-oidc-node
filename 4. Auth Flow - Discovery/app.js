require('dotenv').config();

var request = require('request');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

// Use Passport with OpenId Connect strategy to
// authenticate users with OneLogin
var passport = require('passport')
var OneLoginStrategy = require('passport-openid-connect').Strategy
var User = require('passport-openid-connect').User

var index = require('./routes/index');
var users = require('./routes/users');

var oic = new OneLoginStrategy({
  issuerHost: "https://openid-connect.onelogin.com/oidc", // For EU instances use "https://openid-connect-eu.onelogin.com/oidc"
  client_id: process.env.OIDC_CLIENT_ID,
  client_secret: process.env.OIDC_CLIENT_SECRET,
  redirect_uri: process.env.OIDC_REDIRECT_URI,
  scope: "openid profile"
});

passport.use(oic)
passport.serializeUser(OneLoginStrategy.serializeUser)
passport.deserializeUser(OneLoginStrategy.deserializeUser)

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Passport requires session to persist the authentication
// so were using express-session for this example
app.use(session({
  secret: 'secret squirrel',
  resave: false,
  saveUninitialized: true
}))

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware for checking if a user has been authenticated
// via Passport and OneLogin OpenId Connect
function checkAuthentication(req,res,next){
  if(req.isAuthenticated()){
      next();
  } else{
      res.redirect("/");
  }
}

app.use('/', index);
// Only allow authenticated users to access the /users route
app.use('/users', checkAuthentication, users);

// Initiates an authentication request with OneLogin
// The user will be redirect to OneLogin and once authenticated
// they will be returned to the callback handler below
app.get('/login', passport.authenticate('passport-openid-connect', {
  successReturnToOrRedirect: "/",
  scope: 'profile'
}));

// Callback handler that OneLogin will redirect back to
// after successfully authenticating the user
app.get('/oauth/callback', passport.authenticate('passport-openid-connect', {
  callback: true,
  successReturnToOrRedirect: '/users',
  failureRedirect: '/'
}))

// Destroy both the local session and
// revoke the access_token at OneLogin
app.get('/logout', function(req, res){

  request.post('https://openid-connect.onelogin.com/oidc/token/revocation', {  // For EU instances use "https://openid-connect-eu.onelogin.com/oidc/token/revocation
    'form':{
      'client_id': process.env.OIDC_CLIENT_ID,
      'client_secret': process.env.OIDC_CLIENT_SECRET,
      'token': req.session.accessToken,
      'token_type_hint': 'access_token'
    }
  },function(err, respose, body){

    console.log('Session Revoked at OneLogin');
    res.redirect('/');

  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
