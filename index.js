const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const fs = require('fs');
const INIT_TIME = 30000;
const WAVE_TIME = 30000;

var wave = [];
var waits = [];
fs.readFile('testtwo.txt', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var lines = data.split("\r\n");
  for (i in lines) {
  	var w = lines[i].split(" ");
  	var queue = [];
  	waits.push(w[0]);
  	for (j in w) {
  		if (j!=0) {
	  		var z = w[j].split(',');
  			queue.push(z);
  		}
  	}
  	wave.push(queue);
  }
});


var clientIds = [];
var clientsReady={};
var time={};
var host = 0;
var elapsed = 0;
var lanes = 0;
//var refundQueue = [];
var plantQueue = [];
var zombieTimer=0;
var randTimer = INIT_TIME;
var sunTimer = 0;
var currentWave = 0;
var waveCounter = 0;
var waveWait = true;
var intermission = false;
const WAVES_PER_ROUND = 10;
var bannedLanes=[];
var links = {};
var initZombies = [["normal",1],["imp",2],["cone",4],["bucket",16]];
var bonusZombies = [["normal",1],["cone",4],["bucket",16],["football",64],["flying",4],["flyingCone",8],["flyingBucket",24],["umbrella",6],["screen",6],["imp",2],["gargantaur",100]];
bonusZombies.sort((a,b)=>{return a[1]-b[1];});
const allZombies = {
	normal: 1,
	cone: 4,
	bucket: 16,
	football: 64,
	flying: 4,
	flyingCone: 8,
	flyingBucket: 24,
	umbrella: 6,
	screen: 6,
}
var zombies = [["normal",1],["imp",2],["cone",4],["bucket",16]];//,["football",64],["flying",4],["flyingCone",8],["flyingBucket",24],["umbrella",6],["screen",6]];
zombies.sort((a,b)=>{return a[1]-b[1];});
console.log(zombies);
//const sampleWave = [[["normal","normal"],10,false]];

function genZomb(diff) {
	var maxDiff = -1;
	var buffer = difficulty/10;
	for (i=0; i<zombies.length; i++) {
		if ((buffer+diff)>=zombies[i][1]) {
			maxDiff=i;
		}
	}
	//console.log(maxDiff);
	var roll = Math.floor(Math.random()*(maxDiff+1));
	if (waveCounter>=0&&zombies[roll][1]*2<(buffer+diff)) {
		if (Math.random()>0.75) {
			return [roll,true];
		} else {
			return [roll,false];
		}
	} else {
		return [roll,false];
	}
}

app.get('/', (req, res) => {
	res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.sendFile(__dirname + '/index.html');
});

function randomComb(p) {
	var arr = [];
	for (i=0; i<lanes; i++) {
		arr.push(i);
	}
	for (i=0; i<lanes-p; i++) {
		arr.splice(Math.floor(arr.length*Math.random()),1);
	}
	return arr;
}

let difficulty=0;

let zombieQueue = [];
  let zombieCounter=0;
let zombieComb = [];

io.on('connection', (socket) => {
	console.log(socket.id);
	clientIds.push(socket.id);
	if (!host) {
		host = socket.id;
		io.to(host).emit('host');
		console.log("new host");
	}
	clientsReady[socket.id]=false;
	socket.on('init', (l) => {
		if (lanes==0) {lanes=l;}
		console.log(lanes);
	});
socket.on('confirmPlant',(type,id) => {
	io.to(id).emit('confirm',type);
});
socket.on('refund',(type,id) => {
	io.to(id).emit('refund',type);
});
  socket.on('plant', (x,y,type,cost,h,id) => {
  	/*let conflict = false;
  	for (i in plantQueue) {
  		if (x==plantQueue[i][0]&&y==plantQueue[i][1]) {
  			conflict = true;
  		}
  	}
  	if (!conflict) {
	    io.emit('plant', x,y,type);
	    plantQueue.push([x,y]);
	} else {
		io.emit('refund',cost,socket.id);
	}*/
	if (h) {
		/*for (i in clientIds) {
			if (i!=host) {
				io.to(i).emit('plant',x,y,type,id);
			}
		}*/
	} else {
		io.to(host).emit('plant',x,y,type,id);
	}
  });
  socket.on('zombie',(lane,type,ambush) => {
  	//if (!h) {
  		io.emit('zombie',lane,type,ambush);
  	//}
  });
  socket.on('shovel',(x,y,h) => {
  	if (h) {
  		/*for (i in clientIds) {
			if (i!=host) {
				io.to(i).emit('shovel',x,y);
			}
		}*/
  	} else {
  		io.to(host).emit('shovel',x,y);
  	}
  })
  socket.on('disconnect', function() {
  	var i = clientIds.indexOf(socket.id);
  	console.log('ok');
  	clientIds.splice(i,1);
  	delete clientsReady[socket.id];
  	console.log(clientIds.length);
  	if (socket.id==host) {
  		if (clientIds[0]) {
  			console.log("new host "+clientIds[0]);

	  		host=clientIds[0];
	  		io.to(host).emit("host");
  		} else {
  			console.log("no host");
  			host=0;
  		}
  	}
  });
  socket.on('reset', () => {
  	zombieTimer=0;
  	randTimer = INIT_TIME;
  	sunTimer=0;
	  zombieCounter=0;
	  difficulty=0;
	  currentWave=0;
	  waveCounter=0;
	  waveWait=true;
	  zombies = initZombies;
  	io.emit('reset');
  });
  socket.on('softreset',()=>{
  	//generate new wave
  	zombieTimer=0;
  	randTimer = WAVE_TIME;
  	sunTimer=0;
  	//roundNumber++;
	  currentWave=0;
	  //waveCounter=0;
	  waveWait=true;
  	io.emit('softreset');
  });
  socket.on('ready',()=> {
  	clientsReady[socket.id]=true;
  	var allReady = true;
  	for (i in clientsReady) {
  		if (!clientsReady[i]) {
  			allReady=false;
  		}
  	}
  	if (allReady) {
  		if (socket.id==host) {
  			intermission=false;
  			io.emit('ready');
  		}
  	}
  });
  socket.on('unready',()=> {
  	clientsReady[socket.id]=false;
  });
  socket.on('done',(t,tick,q,next,seed) => {
  	/*if (!host) {
		host = socket.id;
	}*/
	/*if (f) {
  		clientsReady[id] = true;
  	}*/
  	//	console.log("woo");
  	//}
  	//if (socket.id==host) {

  		elapsed+=t;
  		zombieTimer+=t;
  		randTimer-=t;
  		sunTimer+=t;
  		if (Math.floor(sunTimer/10000)!=Math.floor((sunTimer-t)/10000)&&sunTimer>5000){
  			io.emit('sun',50);
  		}
  		/*if (waveWait) {
  			if (zombieTimer>=waits[currentWave]*1000||next) {
  				if (next) {
		  			console.log("empty");
		  		}
  				waveWait = false;
  				zombieTimer=0;
  			}
  		} else {
  			if (currentWave<wave.length) {
  				if (waveCounter<wave[currentWave].length) {
  					if (zombieTimer>=wave[currentWave][waveCounter][0]*1000) {
  						var spawnIn = Math.floor(wave[currentWave][waveCounter][2]);//Math.floor(wave[currentWave][waveCounter][2]);
  						if (!(spawnIn>=1&&spawnIn<=lanes)) {
  							if (bannedLanes.length<lanes) {
	  							var chosen = Math.floor(Math.random()*(lanes-bannedLanes.length));
	  							console.log(chosen);
	  							spawnIn = Math.floor(Math.random()*lanes)+1;
	  							for (i=0; i<lanes; i++) {
									if (!bannedLanes.includes(i+1)) {;
										chosen--;
										if (chosen==-1) {
											spawnIn=i+1;
											break;
										}
									}
	  							}
  							} else {
  								spawnIn = Math.floor(Math.random()*lanes)+1;
  							}
		  				}
		  				if (wave[currentWave][waveCounter].length>3) {
		  					for (i=3;i<wave[currentWave][waveCounter].length; i++) {
								switch (wave[currentWave][waveCounter][i]) {
									case "alone":
										if (!bannedLanes.includes(spawnIn)) {
											bannedLanes.push(spawnIn);
											console.log(spawnIn+" b&")
										}
										break;
									case "link":
										if (links[wave[currentWave][waveCounter][2]]) {
											spawnIn=links[wave[currentWave][waveCounter][2]];
										} else {
											links[wave[currentWave][waveCounter][2]] = spawnIn;
										}
										break;
									default:
										break;
								}
							}
		  				}
		  				io.to(host).emit('zombie',Math.floor(spawnIn)-1,wave[currentWave][waveCounter][1],0);//could be random lane???
		  				if (clientIds.length>1) {
		  					var extras = randomComb(clientIds.length-1,lanes-1);
		  					for (j in extras) {
		  						io.to(host).emit('zombie',extras[j]+(extras[j]>=(wave[currentWave][waveCounter][2]-1)),wave[currentWave][waveCounter][1],0);
		  					}
		  				}

		  				waveCounter++;
		  				zombieTimer=0;//-=wait;
		  			}
  				} else {
  					currentWave++;
		  			bannedLanes=[];
					links = {};
		  			waveCounter=0;
		  			waveWait=true;
  				}
  			} else {
  				//win
  			}
  		}*/
  		if (intermission&&next&&waveWait) {
  			//generate new wave
			  	zombieTimer=0;
			  	randTimer = WAVE_TIME;
			  	sunTimer=0;
			  	//roundNumber++;
				  currentWave=0;
				  //waveCounter=0;
				  zombies = bonusZombies;
			  	io.emit('softreset');
  		}

	 	
  		if (!intermission&&(randTimer<=0||(next&&waveWait&&sunTimer>INIT_TIME+WAVE_TIME/2))) {//Math.floor((zombieTimer-15000)/15000)!=Math.floor((zombieTimer-15000-t)/15000)&&zombieTimer>25000) {
  			difficulty += Math.pow(Math.max(1,waveCounter+1),1.6)*clientIds.length*(1+(clientIds.length-1)*(1-1/(waveCounter/3+1)));
  			zombieComb = randomComb(Math.min(Math.ceil(Math.log(clientIds.length*(difficulty+1))/Math.log(2)),lanes));
  			console.log("wave "+(waveCounter+1));
  			console.log("total "+difficulty);
  			console.log("current "+(difficulty-zombieCounter));
  			randTimer=WAVE_TIME;
  			waveWait=false;
  			waveCounter++;
  			if ((waveCounter)%WAVES_PER_ROUND==0&&!intermission) {
  				intermission=true;
  				
  			}
  		}
  			//console.log(difficulty);

  			var diff = difficulty-zombieCounter;
  			if (diff>=1) {
	  			var zType = genZomb(diff);
	  			if (zType[0]>=0&&Math.floor(sunTimer/500)!=Math.floor((sunTimer-t)/500)){
	  				var l = zombieComb[Math.floor(Math.random()*zombieComb.length)];
	  				var amb=0;
	  				if (zType[1]) {
	  					amb=3.5; //to be changed
	  				}
		  			io.to(host).emit('zombie',l,zombies[zType[0]][0],amb);
		  			zombieCounter+=zombies[zType[0]][1];
		  			if (zType[1]) {
		  				zombieCounter+=zombies[zType[0]][1];
		  			}
		  			console.log(zombies[zType[0]][0]+" "+l);
	  			}
  			} else {
  				if (!next) {
  					waveWait=true;
  				}
  			}
  			/*
  			if (difficulty<=lanes/2) {
  				var comb = randomComb(difficulty);
  				for (i=0; i<comb.length; i++) {
  					io.to(host).emit('zombie',comb[i],'normal');
  				}
  			} else if (difficulty<=lanes*lanes/4) {
  				var comb = randomComb(Math.floor(difficulty/lanes*2));
  				for (i=0; i<comb.length; i++) {
  					io.to(host).emit('zombie',comb[i],'cone');
  				}
  			} else if (difficulty<=lanes*lanes*lanes/8) {
  				var comb = randomComb(Math.floor(difficulty/lanes/lanes*4));
  				for (i=0; i<comb.length; i++) {
  					io.to(host).emit('zombie',comb[i],'bucket');
  				}
  			} else {
  				var comb = randomComb(Math.min(lanes,Math.floor(difficulty/lanes/lanes/lanes*8)));
  				for (i=0; i<comb.length; i++) {
  					io.to(host).emit('zombie',comb[i],'football');
  				}
  			}*/
  		

  		//for (i in clientIds) {
		//	if (i!=host) {
				io.emit('done',t,tick,waveCounter,q,seed);
		//	}
		//}
  	//}
  	//time[id] += t;
  	/*var allReady = true;
  	for (i in clientIds) {
  		if (!clientsReady[clientIds[i]]) {
  			allReady = false;
  		}
  	} 
  	if (allReady) {
  		var maxTime = 0;
  		for (i in clientIds) {
  			maxTime = Math.max(maxTime,time[clientIds[i]]);
  		}
  		
  		allReady=false;

  		io.emit('done',elapsed,zombieTimer);
  		for (i in clientIds) {
  			time[clientIds[i]]=0;
  			clientsReady[clientIds[i]]=false;
  			elapsed=0;
  		}
  	}
  	plantQueue = [];*/
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});

