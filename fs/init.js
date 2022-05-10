load('api_config.js');
load('api_gcp.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_pwm.js');
load('api_sys.js');
load('api_rpc.js');
load('api_gpio.js');
load('api_adc.js');

// set MQTT topics

let topicsubconfig = '/devices/' + Cfg.get('device.id') + '/config';
let topicsubcommand = '/devices/' + Cfg.get('device.id') + '/commands';
let topicsubcommandreset = '/devices/' + Cfg.get('device.id') + '/commands/reset';
let topicpubstate = '/devices/' + Cfg.get('device.id') + '/state';
let topicpubevents = '/devices/' + Cfg.get('device.id') + '/events/fan';
let topicpubeventshtml = '/devices/' + Cfg.get('device.id') + '/events/html';

// declare variables

let speed = Cfg.get('app.pwm.val');
let apppin = Cfg.get('app.pin');
let apppwmgra = Cfg.get('app.pwm.gra');
let oldspeed = Cfg.get('app.old.speed');
let speedpwm = 50;
let mqttconnection = false;
let mqttconnectionnew = true;
let args;

let pin0 = 25;  //numbers corespond to GPIO pins on ESP
let pin1 = 26;
let pin2 = 27;
let pin3 = 32;

let state0 = 0;
let state1 = 0;
let state2 = 0;
let state3 = 0;

// declare input modes for RF receiver pins

GPIO.set_mode(pin0, GPIO.MODE_INPUT);
GPIO.set_mode(pin1, GPIO.MODE_INPUT);
GPIO.set_mode(pin2, GPIO.MODE_INPUT);
GPIO.set_mode(pin3, GPIO.MODE_INPUT);


// functions declarations START

function setStateZero() {        //puting to 0 input states variables for RF reciver
  state0 = 0;
  state1 = 0;
  state2 = 0;
  state3 = 0;
  print ("States set to zero")
}

function setSpeed () {             //setting speed in percentage PWM based on speed value 1..4 and config parameter for start direction and speed value from server
  if (apppwmgra){
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
  print("Hitrost nastavljena na: ", speedpwm);
};


function SetOldSpeed() {   //setting speed in percentage PWM based on speed value 1..4 and config parameter for start direction based on oldspeed --> return fromboost
  
  if (apppwmgra){
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
  }
  print("Hitrost nastavljena na: ", speedpwm);
};

function mqttReEstablished() {
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
};


// functions declarations END


setSpeed(); //postavi ventilator na začetno hitrost kot nastavljeno v mos.yml parameter - app.pwm.val
print(speedpwm);
PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
mqttconnectionnew = MQTT.isConnected(); //preveri če je mqtt povezan

mqttReEstablished();   //izvede sinhronizacijo na server če prej mqtt ni bil povezan sedaj je pa spet


let oldtimer = Timer.set(Cfg.get('app.pwm.time'), true, function() {
  speedpwm = 99-speed-speedpwm;
  print("PWM set to initial speed:", speedpwm);
  PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
  mqttconnectionnew = MQTT.isConnected();
  mqttReEstablished();
}, null);
 

MQTT.sub(topicsubconfig, function(conn, topic, msg) {
  //{“domId”: "dom", “userId”: "usernew", “name”: ”my-fan”, “nightFan”: ”true”, “groupA”: ”false”, "maxNightSpeed":2, "uploadFanConfig":true}
  if (Cfg.get('app.cfg.rst')) {
    print("First config from server skipped as device was reseted before --> app.cfg.rst set to FALSE");
    Cfg.set({app: {cfg: {rst: false}}});
  } else {

      let obj = JSON.parse(msg) || {};
      Cfg.set({app: {user: obj.userId}});
      Cfg.set({app: {name: obj.name}});
      Cfg.set({app: {home: obj.domId}});  

    if (obj.uploadFanConfig){
    // uploadFanConfig=true --> NE vpiše vrednosti iz strežnika na ventilator
   // če je uploadConfig true potem objavi nazaj na konfiguracijo --> potegne podatke iz ventialtorja in jih nastavi v fansConfig pod imenom ventilatorja 
      print("uploadFanConfig=true --> NE zapisujem parametre iz serverja na modul");
      let msg = JSON.stringify({type: "fanconfig", domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), nightFan: Cfg.get('app.pwm.night'), groupA: Cfg.get('app.pwm.gra'), maxNightSpeed: Cfg.get('app.night.speed'), uploadFanConfig: false, currentFanSpeed: Cfg.get('app.pwm.val'), timeChangeDirection: Cfg.get('app.pwm.time')});
      print(topicpubstate, '->', msg);
      print("Objavim nazaj na server parametre iz modula");

      MQTT.pub(topicpubstate, msg, 1);

    } else {
      Cfg.set({app: {pwm: {night: obj.nightFan}}});
      Cfg.set({app: {pwm: {gra: obj.groupA}}});
      Cfg.set({app: {night: {speed: obj.maxNightSpeed}}});
      print("uploadFanConfig=false --> JA zapisujem parametre iz serverja na modul in nic ne objavim nazaj");
    } 
 }
 }, null);




 MQTT.sub(topicsubcommand, function(conn, topic, msg) {
//  {“speed”: 2, “auto”: false, “boost”: false, “night”: false, “summer”: false, "boostCountDown":3600000}
  let obj = JSON.parse(msg) || {};
  
  // takoj izračunamo in postavimo hitrost ventilatorja zato, da je hiter odziv
  speed=obj.speed;
  setSpeed();
  PWM.set(apppin, 1000, speedpwm/100);  
 // konec takojšnje postavitve na določeno hitrost oziroma odzivnost ventilatorja


  Cfg.set({app: {pwm: {val: obj.speed}}});
  Cfg.set({app: {mode: {avto: obj.auto}}});
  Cfg.set({app: {mode: {night: obj.night}}});
  Cfg.set({app: {mode: {summer: obj.summer}}});
  Cfg.set({app: {mode: {boost: obj.boost}}});
  Cfg.set({app: {boost: {time: obj.boostCountDown}}});


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

      SetOldSpeed();

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

  setSpeed();

  Timer.del(oldtimer);
  let msg = JSON.stringify({type: "fan", domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), currentFanSpeed: speed, timeChangeDirection: Cfg.get('app.pwm.time')});
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
    mqttReEstablished();
  }, null);
  oldtimer = newtimer;

//konec MQTT.sub
 }, null);

 // reset modula nazaj na ap ko se zbriše baza oz. dobi sporocil {"reset"=true na commands subfolder reset}
 MQTT.sub(topicsubcommandreset, function(conn, topic, msg) {
    // {"reset":true}, postavi wifi parametre in app.fcg.rst na true da bo lahko potem prvič potegnil gor konfig
    let obj = JSON.parse(msg) || {};
    print('Dobil sporocilo za reset');
    Cfg.set({wifi: {sta: {enable: false}}});
    Cfg.set({wifi: {sta: {ssid: ""}}});
    Cfg.set({wifi: {sta: {pass: ""}}});
    Cfg.set({wifi: {ap: {enable: true}}});
    Cfg.set({app: {cfg: {rst: true}}});
    Sys.reboot(10000);    
  }, null);


// starts handlers for html control

  RPC.addHandler('ControlNight', function(args) {
    //shrani parameter
    Cfg.set(args);
    print(JSON.stringify(args));
    
    //če je povezan na strežnik mora objaviti 

        //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubevents
        if (MQTT.isConnected()) {  
          let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: Cfg.get('app.pwm.val')});
          print(topicpubeventshtml, '->', msg);
          MQTT.pub(topicpubeventshtml, msg, 1);
        }

  });

  RPC.addHandler('ControlSummer', function(args) {
    Cfg.set(args);
    print(JSON.stringify(args));
    //če je true postavi config za time na 3600 in ponovno starta timer za hitrost
    if (args.app.mode.summer){
      Cfg.set({app: {pwm: {time: 3600000}}});
      print("Change over time set to ", Cfg.get('app.pwm.time'));
    } else {
      Cfg.set({app: {pwm: {time: 70000}}});
      print("Change over time set to ", Cfg.get('app.pwm.time'));
    };
    speed=Cfg.get('app.pwm.val');
    setSpeed();
    print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
    PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
    //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubeventshtml
    if (MQTT.isConnected()) {  
      let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
      print(topicpubeventshtml, '->', msg);
      MQTT.pub(topicpubeventshtml, msg, 1);
    };
    //zbriše prejšnji in starta nov timer, ki se ponavlja z zakasnitvijo kot nastavljeno v parametrih, le če ni objavil, sicer se to nastavi iz strežnika
      Timer.del(oldtimer);
      let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
        speedpwm = 99-speed-speedpwm;
        print("PWM set to config speed:", speedpwm);
        PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
        mqttconnectionnew = MQTT.isConnected();
        mqttReEstablished();
      }, null);
      oldtimer = newtimer;
  //konec nastavljanja hitrosti
   
  });


  RPC.addHandler('ControlBoost', function(args) {
    Cfg.set(args);
    print(JSON.stringify(args));
    oldspeed = Cfg.get('app.old.speed');
    //če je true postavi hitrost na 4
    if (args.app.mode.boost){
      print("Ventilator HITROST == 4 --> BOOST");
      Cfg.set({app: {pwm: {val: 4}}});
      speed=4;
    //nastavi boost timer, da ugasne oziroma prestavi nazaj na oldspeed
      let boosttimer = Timer.set(Cfg.get('app.boost.time'), false, function() {
        Cfg.set({app: {mode: {boost: false}}});
        Cfg.set({app: {pwm: {val: oldspeed}}});
        oldspeed=Cfg.get('app.old.speed');
        SetOldSpeed();
        speed=oldspeed;
        print("Boost je koncan--> boost set to: ", Cfg.get('app.mode.boost'));
        print("PWM set to config speed:", speedpwm);
        PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
      }, null);

      if (MQTT.isConnected()){
        let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
        print(topicpubeventshtml, '->', msg);
        MQTT.pub(topicpubeventshtml, msg, 1);
      };

    } else {
   //če je false postavi  hitrost na oldspeed  
      print("Ventilator HITROST == BOOST--> OLDSPEED");
      speed= Cfg.get('app.old.speed');
      Cfg.set({app: {pwm: {val: speed}}});
    }


    setSpeed();
    print ("Nastavitev hitrosti - speedpwm: ", speedpwm);
    print ("Nastavitev hitrosti - config: ", Cfg.get('app.pwm.val'));
    PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
    //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubeventshtml
    if (MQTT.isConnected()) {  
      let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
      print(topicpubeventshtml, '->', msg);
      MQTT.pub(topicpubeventshtml, msg, 1);
    };
    //zbriše prejšnji in starta nov timer, ki se ponavlja z zakasnitvijo kot nastavljeno v parametrih
      Timer.del(oldtimer);
      let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
       speedpwm = 99-speed-speedpwm;
       print("PWM set to config speed:", speedpwm);
       PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
       mqttconnectionnew = MQTT.isConnected();
       mqttReEstablished();
      }, null);
      oldtimer = newtimer;




  });

  RPC.addHandler('ControlAuto', function(args) {
    //shrani parameter
    Cfg.set(args);
    print(JSON.stringify(args));
    
    //če je povezan na strežnik mora objaviti 

        //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubevents
        if (MQTT.isConnected()) {  
          let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: Cfg.get('app.pwm.val')});
          print(topicpubeventshtml, '->', msg);
          MQTT.pub(topicpubeventshtml, msg, 1);
        }

  });

  RPC.addHandler('ControlSpeed', function(args) {
    //shrani in nastavi novo hitrost
    Cfg.set(args);
    //nastavi tudi parameter old speed na isto vrednost
    Cfg.set({app: {old: {speed: args.app.pwm.val}}});
    print(JSON.stringify(args));
    speed=args.app.pwm.val;
    setSpeed();
    print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
    PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);  

    //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubevents
    if (MQTT.isConnected()) {  
      let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
      print(topicpubeventshtml, '->', msg);
      MQTT.pub(topicpubeventshtml, msg, 1);
    }
    //zbriše prejšnji in starta nov timer, ki se ponavlja z zakasnitvijo kot nastavljeno v parametrih
    Timer.del(oldtimer);
    let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
      speedpwm = 99-speed-speedpwm;
      print("PWM set to config speed:", speedpwm);
      PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
      mqttconnectionnew = MQTT.isConnected();
      mqttReEstablished();
    }, null);
    oldtimer = newtimer;
    //konec nastavljanja hitrosti
  });



  RPC.addHandler('ControlParam', function(args) {
    //shrani in nastavi novo hitrost
    Cfg.set(args);
    print(JSON.stringify(args));
    // če je povezan na strežnik je potrebno configuracijo poslati tudi nazaj na strežnik
    if (MQTT.isConnected()) {
      let msg = JSON.stringify({type: "fanconfig", domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), nightFan: Cfg.get('app.pwm.night'), groupA: Cfg.get('app.pwm.gra'), maxNightSpeed: Cfg.get('app.night.speed'), uploadFanConfig: false, currentFanSpeed: Cfg.get('app.pwm.val'), timeChangeDirection: Cfg.get('app.pwm.time')});
      print(topicpubstate, '->', msg);
      MQTT.pub(topicpubstate, msg, 1);
    }
  });

  RPC.addHandler('Control', function(args) {
    //shrani in nastavi novo hitrost

    Cfg.set(args);
    print(JSON.stringify(args));

  });



  RPC.addHandler('Status', function(){
    let g = Cfg.get('app.pwm.gra');
    let n = Cfg.get('app.pwm.night');
    let m = Cfg.get('app.night.speed');
    let x=true;    
    if (m===2){
      x=true;
    } else {
      x=false;
    }
    return {gra:g, night:n, maxnight:x};
  });

  RPC.addHandler('StatusModes', function(){
    let v = Cfg.get('app.pwm.val');
    let mn = Cfg.get('app.mode.night');
    let ma = Cfg.get('app.mode.avto');
    let ms = Cfg.get('app.mode.summer');
    let mb = Cfg.get('app.mode.boost');
    return {val:v, mnight:mn, mavto:ma, msummer:ms, mboost:mb};
  });


  RPC.addHandler('Connected', function(){
    let connected = MQTT.isConnected();
    return {mqtt:connected};
  });



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
  
  let remotetimer = Timer.set(1000, true, function() {  
   
        if (state0===0 && state1===1 && state2===0 && state3===0) {
          print("Izkljuci ventilator gre na OFF");
          //shrani in nastavi novo hitrost
          //nastavi tudi parameter old speed na isto vrednost
          Cfg.set({app: {pwm: {val: 0}}});
          Cfg.set({app: {old: {speed: 0}}});
          speed=0;
          setSpeed();
          print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
          PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);  

          //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubevents 
          if (MQTT.isConnected()) {  
            let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
            print(topicpubeventshtml, '->', msg);
            MQTT.pub(topicpubeventshtml, msg, 1);
           }
          //zbriše prejšnji in starta nov timer, ki se ponavlja z zakasnitvijo kot nastavljeno v parametrih
          Timer.del(oldtimer);
          let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
             speedpwm = 99-speed-speedpwm;
             print("PWM set to config speed:", speedpwm);
             PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
          mqttconnectionnew = MQTT.isConnected();
          mqttReEstablished();
          }, null);
          oldtimer = newtimer;
          //konec nastavljanja hitrosti
          setStateZero();
        };

        if (state0===0 && state1===0 && state2===1 && state3===0) {
          print("Ventilator HITROST == 1")
          //shrani in nastavi novo hitrost
          //nastavi tudi parameter old speed na isto vrednost
          Cfg.set({app: {pwm: {val: 1}}});
          Cfg.set({app: {old: {speed: 1}}});
          speed=1;
          setSpeed();
          print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
          PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);  

          //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubevents 
          if (MQTT.isConnected()) {  
            let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
            print(topicpubeventshtml, '->', msg);
            MQTT.pub(topicpubeventshtml, msg, 1);
           }
          //zbriše prejšnji in starta nov timer, ki se ponavlja z zakasnitvijo kot nastavljeno v parametrih
          Timer.del(oldtimer);
          let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
             speedpwm = 99-speed-speedpwm;
             print("PWM set to config speed:", speedpwm);
             PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
          mqttconnectionnew = MQTT.isConnected();
          mqttReEstablished();
          }, null);
          oldtimer = newtimer;
          //konec nastavljanja hitrosti
          setStateZero();
        };

        if (state0===1 && state1===0 && state2===1 && state3===0) {
          print("Ventilator HITROST == 2")
          //shrani in nastavi novo hitrost
          //nastavi tudi parameter old speed na isto vrednost
          Cfg.set({app: {pwm: {val: 2}}});
          Cfg.set({app: {old: {speed: 2}}});
          speed=2;
          setSpeed();
          print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
          PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);  

          //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubevents 
          if (MQTT.isConnected()) {  
            let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
            print(topicpubeventshtml, '->', msg);
            MQTT.pub(topicpubeventshtml, msg, 1);
           }
          //zbriše prejšnji in starta nov timer, ki se ponavlja z zakasnitvijo kot nastavljeno v parametrih
          Timer.del(oldtimer);
          let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
             speedpwm = 99-speed-speedpwm;
             print("PWM set to config speed:", speedpwm);
             PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
          mqttconnectionnew = MQTT.isConnected();
          mqttReEstablished();
          }, null);
          oldtimer = newtimer;
          //konec nastavljanja hitrosti
          setStateZero();
        };

        if (state0===0 && state1===1 && state2===1 && state3===0) {
          print("Ventilator HITROST == 3")
          //shrani in nastavi novo hitrost
          //nastavi tudi parameter old speed na isto vrednost
          Cfg.set({app: {pwm: {val: 3}}});
          Cfg.set({app: {old: {speed: 3}}});
          speed=3;
          setSpeed();
          print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
          PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);  

          //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubevents 
          if (MQTT.isConnected()) {  
            let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
            print(topicpubeventshtml, '->', msg);
            MQTT.pub(topicpubeventshtml, msg, 1);
           }
          //zbriše prejšnji in starta nov timer, ki se ponavlja z zakasnitvijo kot nastavljeno v parametrih
          Timer.del(oldtimer);
          let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
             speedpwm = 99-speed-speedpwm;
             print("PWM set to config speed:", speedpwm);
             PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
          mqttconnectionnew = MQTT.isConnected();
          mqttReEstablished();
          }, null);
          oldtimer = newtimer;
          //konec nastavljanja hitrosti
          setStateZero();
        };


        if (state0===0 && state1===1 && state2===1 && state3===1) {
          print("Pritisnil gumb BOOST na daljincu")
          // potrebno nastaviti BOOST kot v html
          if (Cfg.get('app.mode.boost')){
            Cfg.set({app: {mode: {boost: false}}});

            print("BOOST gre na OFF in HITROST == BOOST--> OLDSPEED");
            speed= Cfg.get('app.old.speed');
            Cfg.set({app: {pwm: {val: speed}}});

          //konec nastavljanja hitrosti            

          }  else {
            print("Ventilator HITROST == 4 --> BOOST");
            //nastavi hitrost 4
            Cfg.set({app: {mode: {boost: true}}});
            Cfg.set({app: {pwm: {val: 4}}});
            speed=4;
          //konec nastavljanja hitrosti
            //nastavi boost timer, da ugasne oziroma prestavi nazaj na oldspeed
            let boosttimer = Timer.set(Cfg.get('app.boost.time'), false, function() {
              Cfg.set({app: {mode: {boost: false}}});
              Cfg.set({app: {pwm: {val: oldspeed}}});
              oldspeed=Cfg.get('app.old.speed');
              SetOldSpeed();
              speed=oldspeed;
              print("Boost je koncan--> boost set to: ", Cfg.get('app.mode.boost'));
              print("PWM set to config speed:", speedpwm);
              PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
               
              if (MQTT.isConnected()){
                let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
                print(topicpubeventshtml, '->', msg);
                MQTT.pub(topicpubeventshtml, msg, 1);
              };
            }, null);
          }

          setSpeed();
          print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
          print ("Nastavitev hitrosti - config: ", Cfg.get('app.pwm.val'));
          PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
    
          if (MQTT.isConnected()) {  
            let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
            print(topicpubeventshtml, '->', msg);
            MQTT.pub(topicpubeventshtml, msg, 1);
          };
          //zbriše prejšnji in starta nov timer, ki se ponavlja z zakasnitvijo kot nastavljeno v parametrih
          Timer.del(oldtimer);
          let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
            speedpwm = 99-speed-speedpwm;
            print("PWM set to config speed:", speedpwm);
            PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
            mqttconnectionnew = MQTT.isConnected();
            mqttReEstablished();
          }, null);
          oldtimer = newtimer;

          //konec nastavitve boost
          setStateZero();
        };
  




        if (state0===0 && state1===1 && state2===0 && state3===1) {
          print("NOČNI NAČIN")
          // potrebno nastvaiti nočni kot v html
          if (Cfg.get('app.mode.night')){
            Cfg.set({app: {mode: {night: false}}});
          } else {
            Cfg.set({app: {mode: {night: true}}});
          }
          print("Night mode set to: ", Cfg.get('app.mode.night'));

          //če je povezan na strežnik mora objaviti 
      
              //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubevents
              if (MQTT.isConnected()) {  
                let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: Cfg.get('app.pwm.val')});
                print(topicpubeventshtml, '->', msg);
                MQTT.pub(topicpubeventshtml, msg, 1);
              }
          // konec nastavitve night mode
          setStateZero();
        };
  
  
        if (state0===1 && state1===1 && state2===0 && state3===1) {
          print("AUTO NAČIN")
          // potrebno nastvaiti AUTO kot v html
          if (Cfg.get('app.mode.avto')){
            Cfg.set({app: {mode: {avto: false}}});
          } else {
            Cfg.set({app: {mode: {avto: true}}});
          }
          print("Auto mode set to: ", Cfg.get('app.mode.avto'));
          //če je povezan na strežnik mora objaviti 
              //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubevents
              if (MQTT.isConnected()) {  
                let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: Cfg.get('app.pwm.val')});
                print(topicpubeventshtml, '->', msg);
                MQTT.pub(topicpubeventshtml, msg, 1);
              }
          // konec nastavitve AUTO
          setStateZero();
        };
  
  
        if (state0===1 && state1===0 && state2===1 && state3===1) {
          print("POLETNI NAČIN")
          // potrebno nastvaiti POLETNI kot v html
          if (Cfg.get('app.mode.summer')){
            Cfg.set({app: {mode: {summer: false}}});
            Cfg.set({app: {pwm: {time: 70000}}});
          } else {
            Cfg.set({app: {mode: {summer: true}}});
            Cfg.set({app: {pwm: {time: 3600000}}});
          }
          
          print("Summer mode set to: ", Cfg.get('app.mode.summer'));
          print("Change over time set to ", Cfg.get('app.pwm.time'));
          speed=Cfg.get('app.pwm.val');
          setSpeed();
          print ("Mastavitev hitrosti - speedpwm: ", speedpwm);
          PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
          //objavi na strežnik le če je MQTT povezan --> mora objaviti pod user in ne pod ventilator, da se potem vsi sinhronizirajo -> torej na topicpubeventshtml
          if (MQTT.isConnected()) {  
            let msg = JSON.stringify({domId: Cfg.get('app.home'), userId: Cfg.get('app.user'), boost: Cfg.get('app.mode.boost'), auto: Cfg.get('app.mode.avto'), summer: Cfg.get('app.mode.summer'), night: Cfg.get('app.mode.night'), speed: speed});
            print(topicpubeventshtml, '->', msg);
            MQTT.pub(topicpubeventshtml, msg, 1);
          };
          //zbriše prejšnji in starta nov timer, ki se ponavlja z zakasnitvijo kot nastavljeno v parametrih, le če ni objavil, sicer se to nastavi iz strežnika
            Timer.del(oldtimer);
            let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
              speedpwm = 99-speed-speedpwm;
              print("PWM set to config speed:", speedpwm);
              PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
              mqttconnectionnew = MQTT.isConnected();
              mqttReEstablished();
            }, null);
            oldtimer = newtimer;
        //konec nastavljanja hitrosti  
          // konect nastavitev POLETNI kot v html
          setStateZero();
        };
      }, null);
  
  
