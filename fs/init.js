load('api_config.js');
load('api_gcp.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_pwm.js');
load('api_sys.js');
load('api_rpc.js');
load('api_gpio.js');
load('api_adc.js');

let topicsubconfig = '/devices/' + Cfg.get('device.id') + '/config';
let topicsubcommand = '/devices/' + Cfg.get('device.id') + '/commands';
let topicsubcommandreset = '/devices/' + Cfg.get('device.id') + '/commands/reset';
let topicpubstate = '/devices/' + Cfg.get('device.id') + '/state';
let topicpubevents = '/devices/' + Cfg.get('device.id') + '/events/fan';

let speed = Cfg.get('app.pwm.val');
let oldspeed = Cfg.get('app.old.speed');
let speedpwm = 50;
let mqttconnection = true;
let mqttconnectionnew = true;
let pin = 0;
let pin0 = 13;
let pin1 = 12;
let pin2 = 14;
let pin3 = 5;
let analog = 0;
let state0 = 0;
let state1 = 0;
let state2 = 0;
let state3 = 0;

ADC.enable(pin);
GPIO.set_mode(pin0, GPIO.MODE_INPUT);
GPIO.set_mode(pin1, GPIO.MODE_INPUT);
GPIO.set_mode(pin2, GPIO.MODE_INPUT);
GPIO.set_mode(pin3, GPIO.MODE_INPUT);

function setStateZero() {
  state0 = 0;
  state1 = 0;
  state2 = 0;
  state3 = 0;
}

function setSpeed () {
  if (Cfg.get('app.pwm.gra')){
    //speedpwm=50+12*speed;
    if (speed===0){
      speedpwm=50;
    }
    if (speed===1){
      speedpwm=72;
    }
    if (speed===2){
      speedpwm=83;
    }
    if (speed===3){
      speedpwm=87;
    }
    if (speed===4){
      speedpwm=91;
    }
  }else{
    //speedpwm=50-12*speed;
    if (speed===0){
      speedpwm=50;
    }
    if (speed===1){
      speedpwm=26;
    }
    if (speed===2){
      speedpwm=14;
    }
    if (speed===3){
      speedpwm=9;
    }
    if (speed===4){
      speedpwm=4;
    }
  }
};


setSpeed();

print(speedpwm);

mqttconnectionnew = MQTT.isConnected();
if (mqttconnectionnew === true){
  if (mqttconnection === false){
    let msg = JSON.stringify({type: "startupfan", domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), currentFanSpeed: speed, timeChangeDirection: Cfg.get('app.pwm.time')});
    print(topicpubstate, '->', msg);
    MQTT.pub(topicpubstate, msg, 1);
    print ("Objavi podatek na server ker je povezava nazaj --> MQTT connectionnew je: ", mqttconnectionnew);
    mqttconnection = mqttconnectionnew;
  } else {
    print ("MQTT povezava je vseskozi aktivna");
    mqttconnection = mqttconnectionnew;
  }
} else {
  print ("Trenutna MQTT povezava je padla");
  mqttconnection = mqttconnectionnew;
};

GPIO.set_button_handler(pin0, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200,
  function(x) {
    print('Button press, pin: ', x);
    state0=1;
  }, null);

GPIO.set_button_handler(pin1, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200,
  function(x) {
    print('Button press, pin: ', x);
    state1=1;
  }, null);

GPIO.set_button_handler(pin2, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200,
  function(x) {
    print('Button press, pin: ', x); 
    state2=1;
  }, null);

GPIO.set_button_handler(pin3, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200,
  function(x) {
    print('Button press, pin: ', x);
    state3=1;
  }, null);

let remotetimer = Timer.set(2000, true, function() {  
 
      if (state0===0 && state1===1 && state2===0 && state3===0) {
        print("Izkljuci ventilator gre na OFF");
        speed=0;
        setSpeed();
        print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
        PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
        setStateZero();
      };
      if (state0===0 && state1===0 && state2===1 && state3===0) {
        print("Ventilator HITROST == 1")
        speed=1;
        setSpeed();
        print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
        PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
        setStateZero();
      };
      if (state0===1 && state1===0 && state2===1 && state3===0) {
        print("Ventilator HITROST == 2")
        speed=2;
        setSpeed();
        print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
        PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
        setStateZero();
      };
      if (state0===0 && state1===1 && state2===1 && state3===0) {
        print("Ventilator HITROST == 3")
        speed=3;
        setSpeed();
        print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
        PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
        setStateZero();
      };
      if (state0===0 && state1===1 && state2===1 && state3===1) {
        print("Ventilator HITROST == 4 --> BOOST")
        speed=4;
        setSpeed();
        print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
        PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
        setStateZero();
      };

    }, null);




/*
let remotetimer = Timer.set(1000, true, function() {
  analog = 0;
  state0 = 0;
  state1 = 0;
  state2 = 0;
  state3 = 0;
  
  analog = ADC.read(pin);
  state0 = GPIO.read(pin0);
  state1 = GPIO.read(pin1);
  state2 = GPIO.read(pin2);
  state3 = GPIO.read(pin3);

  if (analog>100){
    print("Analogna vrednost JE vecja kot 100 in sicer je: ", analog);
    print("Vrednost vhoda 0 na pin0, D7 vhod: ", state0);
    print("Vrednost vhoda 1 na pin1, D6 vhod: ", state1);
    print("Vrednost vhoda 2 na pin2, D5 vhod: ", state2);
    print("Vrednost vhoda 3 na pin3, D1 vhod: ", state3);
    if (state0===0 && state1===1 && state2===0 && state3===0) {
      print("Izkljuci ventilator gre na OFF");
      speed=0;
      setSpeed();
      print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
      PWet('app.pin'), 1000, speedpwM.set(Cfg.gm/100);
    };
    if (state0===0 && state1===0 && state2===1 && state3===0) {
      print("Ventilator HITROST == 1")
      speed=1;
      setSpeed();
      print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
      PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
    };
    if (state0===1 && state1===0 && state2===1 && state3===0) {
      print("Ventilator HITROST == 2")
      speed=2;
      setSpeed();
      print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
      PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
    };
    if (state0===0 && state1===1 && state2===1 && state3===0) {
      print("Ventilator HITROST == 3")
      speed=3;
      setSpeed();
      print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
      PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
    };
    if (state0===0 && state1===1 && state2===1 && state3===1) {
      print("Ventilator HITROST == 4 --> BOOST")
      speed=4;
      setSpeed();
      print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
      PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
    };
  } else {
    // print("Analogna vrednost NI vecja kot 100 in sicer je: ", analog);
  }

}, null);

*/

let oldtimer = Timer.set(Cfg.get('app.pwm.time'), true, function() {
  speedpwm = 99-speed-speedpwm;
  print("PWM set to initial speed:", speedpwm);
  PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
  mqttconnectionnew = MQTT.isConnected();
  if (mqttconnectionnew === true){
    if (mqttconnection === false){
      let msg = JSON.stringify({type: "startupfan", domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), currentFanSpeed: speed, timeChangeDirection: Cfg.get('app.pwm.time')});
      print(topicpubstate, '->', msg);
      MQTT.pub(topicpubstate, msg, 1);
      print ("Objavi podatek na server ker je povezava nazaj --> MQTT connectionnew je: ", mqttconnectionnew);
      mqttconnection = mqttconnectionnew;
    } else {
      print ("MQTT povezava je vseskozi aktivna");
      mqttconnection = mqttconnectionnew;
    }
  } else {
    print ("Trenutna MQTT povezava je padla");
    mqttconnection = mqttconnectionnew;
  }
}, null);
 
MQTT.sub(topicsubconfig, function(conn, topic, msg) {
  //{“domId”: "dom", “userId”: "usernew", “name”: ”my-fan”, “nightFan”: ”true”, “groupA”: ”false”, "maxNightSpeed":2}
  let obj = JSON.parse(msg) || {};
  Cfg.set({app: {user: obj.userId}});
  Cfg.set({app: {name: obj.name}});
  Cfg.set({app: {home: obj.domId}});  
  Cfg.set({app: {pwm: {night: obj.nightFan}}});
  Cfg.set({app: {pwm: {gra: obj.groupA}}});
  Cfg.set({app: {night: {speed: obj.maxNightSpeed}}});
  print ("User: ", Cfg.get('app.user'), "Home: ", Cfg.get('app.home'), "  Name ", Cfg.get('app.name'), "  Nightfan ", Cfg.get('app.pwm.night'), "  groupA ", Cfg.get('app.pwm.gra'),  " maxNightSpeed ", Cfg.get('app.night.speed'));
  let tm = Timer.now();
  let msg = JSON.stringify({type: "fan", domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), time: tm, currentFanSpeed: Cfg.get('app.pwm.val'), timeChangeDirection: Cfg.get('app.pwm.time')});
  print(topicpubstate, '->', msg);
  MQTT.pub(topicpubstate, msg, 1);
 }, null);




 MQTT.sub(topicsubcommand, function(conn, topic, msg) {
//  {“speed”: 2, “auto”: false, “boost”: false, “night”: false, “summer”: false, "boostCountDown":3600000}
  let obj = JSON.parse(msg) || {};
  Cfg.set({app: {pwm: {val: obj.speed}}});
  print ("Speed: ", obj.speed, "Auto ", obj.auto, "Boost ", obj.boost, "Night ", obj.night, "Summer ", obj.summer, "Countdown", obj.boostCountDown);

// pogoji načinov delovanja 
// ce je mode:summer nastavi app.pwm.time na 1 uro sicer pusti na 70s
  if (obj.summer){
    Cfg.set({app: {pwm: {time: 3600000}}});
    print("Change over time set to ", Cfg.get('app.pwm.time'));
  } else {
    Cfg.set({app: {pwm: {time: 70000}}});
    print("Change over time set to ", Cfg.get('app.pwm.time'));
  };

// shrani prejšnjo hitrost preden je bil boost
  if (!obj.boost){
    Cfg.set({app: {old: {speed: obj.speed}}});
    print("Oldspeed set to ", Cfg.get('app.old.speed'));
  };
  if (obj.boost){
     // postavitev hitrosti na 4 v bazi podatkov ce je izbran boost 
      speed = 4; 
      oldspeed = Cfg.get('app.old.speed');
      Cfg.set({app: {boost: {time: obj.boostCountDown}}});
      print ("Set oldsped: ", oldspeed, "Set countdown: ", Cfg.get('app.boost.time'));

      if (Cfg.get('app.pwm.val') !== 4) {
        print ("Postavi hitrost na 4 na events/fan: ", speed);
        let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: obj.boost, speed: speed});
        print(topicpubevents, '->', msg);
        MQTT.pub(topicpubevents, msg, 1);
      }
      if (Cfg.get('app.pwm.gra')){
        //speedpwm=50+12*speed;
        if (oldspeed===0){
          speedpwm=50;
        }
        if (oldspeed===1){
          speedpwm=72;
        }
        if (oldspeed===2){  
          speedpwm=83;
        }  
        if (oldspeed===3){
          speedpwm=87;
        }
        if (oldspeed===4){
          speedpwm=91;
        }
      }else{
        //speedpwm=50-12*speed;
        if (oldspeed===0){
          speedpwm=50;
        }
        if (oldspeed===1){
          speedpwm=26;
        }
        if (oldspeed===2){
          speedpwm=14;
        }
        if (oldspeed===3){
          speedpwm=9;
        }
        if (oldspeed===4){
          speedpwm=4;
        }
      };

      // one time timer to set boost to false and set back oldspeed
      let boosttimer = Timer.set(Cfg.get('app.boost.time'), false, function() {
        speedpwm = 99-oldspeed-speedpwm;
        print("Boost time ended. Setting BOOST OFF AND speed back to previous speed:", oldspeed);
        let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: false, speed: oldspeed});
        print(topicpubevents, '->', msg);
        MQTT.pub(topicpubevents, msg, 1);
      }, null);


  }else{
    if (obj.night){
      if (Cfg.get('app.pwm.night')){
        if (obj.speed > Cfg.get('app.night.speed')){
          speed = Cfg.get('app.night.speed');
        }else{
          speed = obj.speed;
        }
      }else{
        speed = obj.speed;
      }
    }else{
      speed = obj.speed;
    };
  };
//konec pogojev za fan
// določitev hitrosti ventilatorja glede na groupA - A ali B ventilator
if (Cfg.get('app.pwm.gra')){
  //speedpwm=50+12*speed;
  if (speed===0){
    speedpwm=50;
  }
  if (speed===1){
    speedpwm=72;
  }
  if (speed===2){
    speedpwm=83;
  }
  if (speed===3){
    speedpwm=87;
  }
  if (speed===4){
    speedpwm=91;
  }
}else{
  //speedpwm=50-12*speed;
  if (speed===0){
    speedpwm=50;
  }
  if (speed===1){
    speedpwm=26;
  }
  if (speed===2){
    speedpwm=14;
  }
  if (speed===3){
    speedpwm=9;
  }
  if (speed===4){
    speedpwm=4;
  }
};

  Timer.del(oldtimer);
  let tm = Timer.now();
  let msg = JSON.stringify({type: "fan", domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), time: tm, currentFanSpeed: speed, timeChangeDirection: Cfg.get('app.pwm.time')});
  print(topicpubstate, '->', msg);
  MQTT.pub(topicpubstate, msg, 1);
  // objavi in takoj postavi na novo hitrost
  print("PWM set to config speed:", speedpwm);
  PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);  
  //starta timer ki se ponavlja z zakasnitvijo
  let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
    speedpwm = 99-speed-speedpwm;
    print("PWM set to config speed:", speedpwm);
    PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
    mqttconnectionnew = MQTT.isConnected();
    if (mqttconnectionnew === true){
      if (mqttconnection === false){
        let msg = JSON.stringify({type: "startupfan", domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), currentFanSpeed: speed, timeChangeDirection: Cfg.get('app.pwm.time')});
        print(topicpubstate, '->', msg);
        MQTT.pub(topicpubstate, msg, 1);
        print ("Objavi podatek na server ker je povezava nazaj --> MQTT connectionnew je: ", mqttconnectionnew);
        mqttconnection = mqttconnectionnew;
      } else {
        print ("MQTT povezava je vseskozi aktivna");
        mqttconnection = mqttconnectionnew;
      }
    } else {
      print ("Trenutna MQTT povezava je padla");
      mqttconnection = mqttconnectionnew;
    }

  }, null);
  oldtimer = newtimer;
//konec MQTT.sub
 }, null);

 // reset modula nazaj na ap ko se zbriše baza oz. dobi sporocil {"reset"=true na commands subfolder reset}
 MQTT.sub(topicsubcommandreset, function(conn, topic, msg) {
    // {"reset":true}
    let obj = JSON.parse(msg) || {};
    print('Dobil sporocilo za reset');
    Cfg.set({wifi: {sta: {enable: false}}});
    Cfg.set({wifi: {sta: {ssid: ""}}});
    Cfg.set({wifi: {sta: {pass: ""}}});
    Cfg.set({wifi: {ap: {enable: true}}});
    Sys.reboot(10000);    
  }, null);


  RPC.addHandler('Control', function(args) {
    Cfg.set(args);
    print(JSON.stringify(args));
  });


  RPC.addHandler('Status', function(){
    let g = Cfg.get('app.pwm.gra');
    let n = Cfg.get('app.pwm.night');
    return {gra:g, night:n};
  });



  RPC.addHandler('Connected', function(){
    let connected = MQTT.isConnected();
    return {mqtt:connected};
  });



/*
 
  var delayInMilliseconds = 10000; //10 second
  setTimeout(function() {
      var sta = { enable: true, ssid: g('s').value, pass: g('p').value, bssid: g('bssid').checked===true ? g('b').innerText : '' };		
      var config = { wifi: { sta: sta, ap: { enable: false } } }; 
      var Http = new XMLHttpRequest();
      var url="/rpc/Connected";
      Http.open("GET", url);
      Http.send();
      Http.onreadystatechange = (e) => {
          argget=JSON.parse(Http.responseText);
      if(argget.mqtt==true){
             rpc_call("Config.Set", function (resp) {
             bs.disabled = false;
             bs.style.background = old;
             bss[S]("class", "");
             if(!resp)
               return;
             wl[H] = "Konfiguracija shranjena";
             window.location.href = "index.html";
             }, { config, save: true, reboot: true});
      }
      }   		        
  }, delayInMilliseconds);	