var path = require('path');
var util = require('util');

var express = require('express');
var ejs = require('ejs');
var compression = require('compression');
var bodyParser = require('body-parser');
var multer = require('multer');
var storage = multer.memoryStorage();
var upload = multer({ storage: storage });
var fetch = require('node-fetch');

var yaml = require('js-yaml');

var converter = require('swagger2openapi');
var validator = require('swagger2openapi/validate.js');
var s2oVersion = require('swagger2openapi/common.js').getVersion();

var status = {};
status.startTime = new Date();
status.conversions = 0;
status.validations = 0;
status.targetVersion = converter.targetVersion;
status.s2oVersion = s2oVersion;

function getObj(body,payload){
	var obj = {};
	try {
		obj = JSON.parse(body);
	}
	catch(ex) {
		try {
			obj = yaml.safeLoad(body);
			payload.yaml = true;
		}
		catch(ex) {
			console.log(body);
		}
	}
	return obj;
}

var app = express();
app.use(compression());
app.use(bodyParser.urlencoded({ extended: false }));

app.set('view engine', 'html');
app.engine('html', ejs.renderFile);

app.get('/', function(req,res) { res.render(path.join(__dirname,'index.html'),status) });
app.get('*.html', function(req,res) { res.render(path.join(__dirname,req.path,status)) });
app.use("/",  express.static(__dirname));
app.use("/examples/",  express.static(path.join(__dirname,'examples')));

app.get('/api/v1/status',function(req,res){
	res.send(JSON.stringify(status,null,2));
});

function validate(req, res, badge) {

	status.validations++;
	result = {};
	result.status = false;
	if (req.query.url) {
		fetch(req.query.url).then(function(res) {
 	 		return res.text();
		}).then(function(body) {
			var payload = {};
			var obj = getObj(body,payload);
			try {
				result.status = validator.validate(obj,{});
			}
			catch(ex) {
				result.message = ex.message;
			}
			if (badge) {
				if (result.status) {
					res.redirect('https://img.shields.io/badge/OpenAPI3-Valid-brightgreen.svg');
				}
				else {
					res.redirect('https://img.shields.io/badge/OpenAPI3-Invalid-red.svg');
				}
			}
			else {
	 			res.send(JSON.stringify(result));
			}
		});

	}
	else {
		res.send('You must provide a URL parameter');
	}
}

app.get('/api/v1/validate', function(req,res) {
	validate(req,res,false);
});
app.get('/api/v1/badge', function(req,res) {
	validate(req,res,true);
});

app.post('/api/v1/validate', upload.single('filename'), function(req,res){
	status.validations++;
	var result = {};
	result.status = false;
	var body = req.body.source||(req.file ? req.file.buffer.toString() : '');
	var payload = {};
	payload.prefix = '<html><body><pre>';
	if ((req.headers.accept == 'application/json') || (req.headers.accept.endsWith('yaml'))) {
		payload.prefix = '';
	}
	if (req.headers['content-type'] == 'application/x-www-form-urlencoded') {
		result.warning = 'Your browser sent the wrong Content-Type header. Try pasting your document';
	}
	var obj = getObj(body,payload);
	try {
		result.status = validator.validate(obj,{});
	}
	catch(ex) {
		result.message = ex.message;
	}
	if (payload.yaml) {
		res.send(payload.prefix+yaml.safeDump(result));
	}
	else {
		res.send(payload.prefix+JSON.stringify(result,null,2));
	}
});

app.post('/api/v1/convert', upload.single('filename'), function(req,res){
	status.conversions++;
	var result = {};
	result.status = false;
	var body = (req.body ? req.body.source : '')||(req.file ? req.file.buffer.toString() : '');
	var payload = {};
	payload.prefix = '<html><body><pre>';
	if ((req.headers.accept == 'application/json') || (req.headers.accept.endsWith('yaml'))) {
		payload.prefix = '';
	}
	if (req.headers['content-type'] == 'application/x-www-form-urlencoded') {
		result.warning = 'Your browser sent the wrong Content-Type header. Try pasting your document';
	}
	var obj = getObj(body,payload);
	try {
		result = converter.convert(obj,{});
	}
	catch(ex) {
		result.message = ex.message;
	}
	if (payload.yaml) {
		res.send(payload.prefix+yaml.safeDump(result));
	}
	else {
		res.send(payload.prefix+JSON.stringify(result,null,2));
	}
});

var myport = process.env.PORT || 3000;
if (process.argv.length>2) myport = process.argv[2];

var server = app.listen(myport, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Arapaho server listening at http://%s:%s', host, port);
});
