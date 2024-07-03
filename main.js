import * as THREE from "three"
import {OrbitControls} from "three/addons/controls/OrbitControls.js"
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TextureLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';


class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};


class BasicCharacterController {
  constructor(params) {
    this._Init(params);
  }

  _Init(params) {
    this._params = params;

    this._decceleration = new THREE.Vector3(-0.001, -0.0002, -10.0); // Increase decceleration
    this._acceleration = new THREE.Vector3(0.5, 0.125, 25.0);
    this._velocity = new THREE.Vector3(0, 0, 0);
    this._position = new THREE.Vector3(-40,0,0);

    this._animations = {};
    this._input = new BasicCharacterControllerInput();
    this._stateMachine = new CharacterFSM(
        new BasicCharacterControllerProxy(this._animations));

    this.boundingBox = new THREE.Box3(); // Create a bounding box for the character
    
    this._LoadModels();
    this._masuk = false;
    this._heli = new THREE.Vector3(43.9,1.3,8.2)
  }

  _LoadModels() {
    const loader = new FBXLoader();
    loader.setPath('./resources/Soldier/');
    loader.load('Soldier.fbx', (fbx) => {
      fbx.scale.setScalar(0.015);
      fbx.traverse(c => {
        c.castShadow = true;
      });

      this._target = fbx;
      this._params.scene.add(this._target);
      this._target.position.copy(this._position);
      this._target.rotation.y = Math.PI/2;

      this._mixer = new THREE.AnimationMixer(this._target);

      this._manager = new THREE.LoadingManager();
      this._manager.onLoad = () => {
        this._stateMachine.SetState('idle');
      };

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = this._mixer.clipAction(clip);
  
        this._animations[animName] = {
          clip: clip,
          action: action,
        };
      };

      const animLoader = new FBXLoader(this._manager);
      animLoader.setPath('./resources/Soldier/');
      animLoader.load('Walk_inplace.fbx', (a) => { _OnLoad('walk', a); });
      animLoader.load('Pistol Run.fbx', (a) => { _OnLoad('run', a); });
      animLoader.load('Soldier Idle.fbx', (a) => { _OnLoad('idle', a); });

      this._LoadWeapon();
    });
  }

  _LoadWeapon() {
    const textureLoader = new TextureLoader();
    const baseColor = new THREE.TextureLoader().load('./resources/Soldier/Colt-pistol/TEXTURAS REVOLVER COLT/COLT LOWPOLY_DefaultMaterial_BaseColor.jpg');
    const heightMap = new THREE.TextureLoader().load('./resources/Soldier/Colt-pistol/TEXTURAS REVOLVER COLT/COLT LOWPOLY_DefaultMaterial_Height.jpg');
    const metallicMap = new THREE.TextureLoader().load('./resources/Soldier/Colt-pistol/TEXTURAS REVOLVER COLT/COLT LOWPOLY_DefaultMaterial_Metallic.jpg');
    const normalMap = new THREE.TextureLoader().load('./resources/Soldier/Colt-pistol/TEXTURAS REVOLVER COLT/COLT LOWPOLY_DefaultMaterial_Normal.jpg');
    const roughnessMap = new THREE.TextureLoader().load('./resources/Soldier/Colt-pistol/TEXTURAS REVOLVER COLT/COLT LOWPOLY_DefaultMaterial_Roughness.jpg');

    const weaponMaterial = new THREE.MeshStandardMaterial({
      map: baseColor,
      // displacementMap: heightMap,
      metalnessMap: metallicMap,
      normalMap: normalMap,
      roughnessMap: roughnessMap,
    });

    const loader = new FBXLoader();
    loader.setPath('./resources/Soldier/Colt-pistol/');
    loader.load('COLT LOWPOLY.fbx', (weapon) => {
      weapon.scale.setScalar(0.1);
      weapon.traverse(c => {
        if (c.isMesh) {
          c.castShadow = true;
          c.material = weaponMaterial;
        }
      });

      this._weapon = weapon;

      // Find the right hand bone and attach the weapon to it
      const rightHandBone = this._target.getObjectByName('mixamorigRightHand');
      if (rightHandBone) {
        rightHandBone.add(this._weapon);
        this._weapon.position.set(7, 19.5, 4); // Adjust as needed
        this._weapon.rotation.set(-1.5, 0, -1.7); // Adjust as needed
      } else {
        console.error('Right hand bone not found');
      }
    });
  }

  get Position() {
    return this._position;
  }

  get Rotation() {
    if (!this._target) {
      return new THREE.Quaternion();
    }
    return this._target.quaternion;
  }

  Update(timeInSeconds) {
    if (!this._stateMachine._currentState) {
      return;
    }
  
    this._stateMachine.Update(timeInSeconds, this._input);
  
    const velocity = this._velocity;
    const frameDecceleration = new THREE.Vector3(
        velocity.x * this._decceleration.x,
        velocity.y * this._decceleration.y,
        velocity.z * this._decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z));
  
    velocity.add(frameDecceleration);
  
    const controlObject = this._target;
    const _Q = new THREE.Quaternion();
    const _A = new THREE.Vector3();
    const _R = controlObject.quaternion.clone();
  
    const acc = this._acceleration.clone();
    if (this._input._keys.shift) {
      acc.multiplyScalar(2.0);
    }
  
    if (this._input._keys.forward) {
      velocity.z += acc.z * timeInSeconds;
    }
    if (this._input._keys.backward) {
      velocity.z -= acc.z * timeInSeconds;
    }
    if (this._input._keys.left) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }
    if (this._input._keys.right) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }
  
    controlObject.quaternion.copy(_R);
  
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();
  
    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();
  
    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);
  
    // Save the previous position before updating
    this._previousPosition = controlObject.position.clone();

    if (sideways != 0 || forward != 0) {
      controlObject.position.add(forward);
      controlObject.position.add(sideways);
      //update bounding box
      this.boundingBox.set(
        new THREE.Vector3(controlObject.position.x - 0.5, controlObject.position.y, controlObject.position.z - 0.5),
        new THREE.Vector3(controlObject.position.x + 0.5, controlObject.position.y + 2, controlObject.position.z + 0.5)
      );
      
      this._CheckCollisions();

      if(this._masuk == true) {
        controlObject.position.set(this._heli.x, this._heli.y, this._heli.z);
      }
    }
  
    this._position.copy(controlObject.position);
  
    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }
  }
  

  _CheckCollisions() {
    
    for(var i = 1; i <= 20; i++) {
      const collisionObject = this._params.scene.getObjectByName('collisionBox'+i);
      if (collisionObject) {
        const otherBoundingBox = collisionObject.boundingBox;
        
        if(collisionObject == this._params.scene.getObjectByName('collisionBox15') && this.boundingBox.intersectsBox(otherBoundingBox)) {
          this._masuk = true;
        }
        
        else if (this.boundingBox.intersectsBox(otherBoundingBox)) {
          console.log('Collision detected!');

          // Move the character back to its previous position
          this._target.position.copy(this._previousPosition);

          // Stop the character's movement
          this._velocity.set(0, 0, 0);

          
        }

        
      }
    }
  }
}


class BasicCharacterControllerInput {
  constructor() {
    this._Init();    
  }

  _Init() {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
      toggleCamera: false, // Added toggle camera key

    };
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  }

  _onKeyDown(event) {
    switch (event.keyCode) {
      case 87: // w
        this._keys.forward = true;
        break;
      case 65: // a
        this._keys.left = true;
        break;
      case 83: // s
        this._keys.backward = true;
        break;
      case 68: // d
        this._keys.right = true;
        break;
      case 32: // SPACE
        this._keys.space = true;
        break;
      case 16: // SHIFT
        this._keys.shift = true;
        break;
      case 50: // '2' key
        this._keys.toggleCamera = true; // Toggle camera mode
        break;
    }
  }

  _onKeyUp(event) {
    switch(event.keyCode) {
      case 87: // w
        this._keys.forward = false;
        break;
      case 65: // a
        this._keys.left = false;
        break;
      case 83: // s
        this._keys.backward = false;
        break;
      case 68: // d
        this._keys.right = false;
        break;
      case 32: // SPACE
        this._keys.space = false;
        break;
      case 16: // SHIFT
        this._keys.shift = false;
        break;
      case 50: // '2' key
        this._keys.toggleCamera = false; // Toggle camera mode
        break;
    }
  }
};


class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }

  _AddState(name, type) {
    this._states[name] = type;
  }

  SetState(name) {
    const prevState = this._currentState;
    
    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
};


class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

  _Init() {
    this._AddState('idle', IdleState);
    this._AddState('walk', WalkState);
    this._AddState('run', RunState);
    // this._AddState('dance', DanceState);
  }
};


class State {
  constructor(parent) {
    this._parent = parent;
  }

  Enter() {}
  Exit() {}
  Update() {}
};



class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['walk'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'run') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (input._keys.shift) {
        this._parent.SetState('run');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};


class RunState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'run';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['run'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'walk') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (!input._keys.shift) {
        this._parent.SetState('walk');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};


class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  Update(_, input) {
    if (input._keys.forward || input._keys.backward) {
      this._parent.SetState('walk');
    } 
    // else if (input._keys.space) {
    //   this._parent.SetState('dance');
    // }
  }
};

// final
class FreeRoamCamera {
  constructor(params) {
    this._params = params;
    this._camera = params.camera;

    this._currentPosition = new THREE.Vector3();
    this._currentLookat = new THREE.Vector3();

    this._enabled = false;
    this._prevCameraPosition = null;
    this._prevCameraQuaternion = null;

    this._rotationSpeed = 0.05; // Adjust rotation speed as needed
    this._rollSpeed = 0.05; // Adjust roll speed as needed

    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
  }

  _onKeyDown(event) {
    switch (event.key) {
      case 'i': // 'I' key for forward
        this._moveCameraForward();
        break;
      case 'k': // 'K' key for backward
        this._moveCameraBackward();
        break;
      case 'j': // 'J' key for left
        this._moveCameraLeft();
        break;
      case 'l': // 'L' key for right
        this._moveCameraRight();
        break;
      case 'ArrowUp': // Up arrow key for rotating up
        this._rotateCameraUp();
        break;
      case 'ArrowDown': // Down arrow key for rotating down
        this._rotateCameraDown();
        break;
      case 'ArrowLeft': // Left arrow key for rotating left
        this._rotateCameraLeft();
        break;
      case 'ArrowRight': // Right arrow key for rotating right
        this._rotateCameraRight();
        break;
      case ',': // ',' key for rolling left
        this._rollCameraLeft();
        break;
      case '.': // '.' key for rolling right
        this._rollCameraRight();
        break;
      case '2': // '2' key for toggling free roam
        this._toggleFreeRoam();
        break;
    }
  }

  _toggleFreeRoam() {
    this._enabled = !this._enabled;
    if (this._enabled) {
      this._enableFreeRoam();
    } else {
      this._disableFreeRoam();
    }
  }

  _enableFreeRoam() {
    this._prevCameraPosition = this._camera.position.clone();
    this._prevCameraQuaternion = this._camera.quaternion.clone();

    // Set camera to a fixed position
    this._camera.position.set(0, 50, -50);
    this._camera.lookAt(0, 0, 0);

    // Disable third person camera behavior if it's active
    this._params.disableThirdPersonCamera();
  }

  _disableFreeRoam() {
    if (this._prevCameraPosition) {
      this._camera.position.copy(this._prevCameraPosition);
    }
    if (this._prevCameraQuaternion) {
      this._camera.quaternion.copy(this._prevCameraQuaternion);
    }

    this._prevCameraPosition = null;
    this._prevCameraQuaternion = null;

    // Re-enable third person camera behavior if needed
    this._params.enableThirdPersonCamera();
  }

  _moveCameraForward() {
    if (!this._enabled) return;
    const moveSpeed = 2; // Adjust movement speed as needed
    this._camera.translateZ(-moveSpeed);
  }

  _moveCameraBackward() {
    if (!this._enabled) return;
    const moveSpeed = 2; // Adjust movement speed as needed
    this._camera.translateZ(moveSpeed);
  }

  _moveCameraLeft() {
    if (!this._enabled) return;
    const moveSpeed = 2; // Adjust movement speed as needed
    this._camera.translateX(-moveSpeed);
  }

  _moveCameraRight() {
    if (!this._enabled) return;
    const moveSpeed = 2; // Adjust movement speed as needed
    this._camera.translateX(moveSpeed);
  }

  _rotateCameraUp() {
    if (!this._enabled) return;
    this._camera.rotation.x -= this._rotationSpeed;
  }

  _rotateCameraDown() {
    if (!this._enabled) return;
    this._camera.rotation.x += this._rotationSpeed;
  }

  _rotateCameraLeft() {
    if (!this._enabled) return;
    this._camera.rotation.y -= this._rotationSpeed;
  }

  _rotateCameraRight() {
    if (!this._enabled) return;
    this._camera.rotation.y += this._rotationSpeed;
  }

  _rollCameraLeft() {
    if (!this._enabled) return;
    this._camera.rotation.z += this._rollSpeed;
  }

  _rollCameraRight() {
    if (!this._enabled) return;
    this._camera.rotation.z -= this._rollSpeed;
  }

  Update(timeElapsed) {
    if (!this._enabled) return;

    // Update lookAt position based on camera movement
    this._camera.updateMatrixWorld();
    this._camera.getWorldPosition(this._currentPosition);
    this._camera.getWorldDirection(this._currentLookat);
    this._currentLookat.add(this._currentPosition);
  }
}




class ThirdPersonCamera {
  constructor(params) {
    this._params = params;
    this._camera = params.camera;

    this._currentPosition = new THREE.Vector3();
    this._currentLookat = new THREE.Vector3();

    this._idealOffset = new THREE.Vector3(-2, 4, -5); // Initial ideal offset

    document.addEventListener('keydown', (event) => {
      if (event.keyCode === 49) { // '1' key
        this._idealOffset.set(0, 2.3 , 0.5);  // Set ideal offset to (0, 15, 7.6)
      } else if (event.keyCode === 51) {
        this._idealOffset.set(-2, 4, -5);
      }
    });

    document.addEventListener('wheel', (event) => this._onMouseWheel(event), false);

    this._enabled = true; // Enable third person camera by default
  }

  _onMouseWheel(event) {
    const zoomSpeed = 2.0; // Adjust zoom speed as needed
    if (event.deltaY < 0) {
      // Zoom in
      if(this._idealOffset.z < 0) {
        this._idealOffset.z += zoomSpeed;
        this._idealOffset.x += 0.2*zoomSpeed;
        this._idealOffset.y -= 0.2*zoomSpeed;
      }
    } else if (event.deltaY > 0) {
      // Zoom out
      this._idealOffset.z -= zoomSpeed;
      this._idealOffset.x -= 0.2*zoomSpeed;
      this._idealOffset.y += 0.2*zoomSpeed;
    }
  }

  disable() {
    this._enabled = false;
  }

  enable() {
    this._enabled = true;
  }

  _CalculateIdealOffset() {
    const idealOffset = this._idealOffset.clone(); // Use the current value of _idealOffset
    idealOffset.applyQuaternion(this._params.target.Rotation);
    idealOffset.add(this._params.target.Position);
    return idealOffset;
  }

  _CalculateIdealLookat() {
    const idealLookat = new THREE.Vector3(0, 2, 10);
    idealLookat.applyQuaternion(this._params.target.Rotation);
    idealLookat.add(this._params.target.Position);
    return idealLookat;
  }

  Update(timeElapsed) {
    if (!this._enabled) return;

    // Update logic for third person camera behavior
    const idealOffset = this._CalculateIdealOffset();
    const idealLookat = this._CalculateIdealLookat();

    // const t = 0.05; // You can adjust interpolation speed if needed
    const t = 0.3; // You can adjust interpolation speed if needed

    this._currentPosition.lerp(idealOffset, t);
    this._currentLookat.lerp(idealLookat, t);

    this._camera.position.copy(this._currentPosition);
    this._camera.lookAt(this._currentLookat);
  }
}



class Demo {
  constructor() {
    this._Initialize();
  }

  _Initialize() {
    this._clock = new THREE.Clock();
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    });
    this._threejs.outputEncoding = THREE.sRGBEncoding;
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._threejs.domElement);

    window.addEventListener('resize', () => {
      this._OnWindowResize();
    }, false);

    this._freeRoamCamera = new FreeRoamCamera({
      camera: this._camera,
      scene: this._scene,
    });

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(25, 10, 25);

    this._scene = new THREE.Scene();

    //Hemisphere Light
    var hemisphereLight = new THREE.HemisphereLight(0xB1E1FF, 0xB97A20, 0.5);
    this._scene.add(hemisphereLight);

    //Directional Light
    var directionalLight = new THREE.DirectionalLight(0xd10000, 40);
    directionalLight.position.set(1,1,1);
    directionalLight.target.position.set(-1.6,-1.6,-1.6);
    var directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight);
    // this._scene.add(directionalLightHelper);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.left = - 100;
    directionalLight.shadow.camera.top  = 100;
    directionalLight.shadow.camera.bottom = - 100;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;

    var directionalShadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
    // this._scene.add(directionalShadowHelper);
    // const loader = new THREE.CubeTextureLoader();
    // const texture = loader.load([
    //     './resources/posx.jpg',
    //     './resources/negx.jpg',
    //     './resources/posy.jpg',
    //     './resources/negy.jpg',
    //     './resources/posz.jpg',
    //     './resources/negz.jpg',
    // ]);
    // texture.encoding = THREE.sRGBEncoding;
    // this._scene.background = texture;

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(120,50),
        new THREE.MeshPhongMaterial({
            color: 0x242424,
            side: THREE.DoubleSide
          }));
    plane.castShadow = true;
    plane.receiveShadow = true;
    plane.rotation.x = 1.57;
    this._scene.add(plane);

    this._mixers = [];
    this._previousRAF = null;

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0 // Adjust the opacity as needed
    });
    
    const geometry = new THREE.BoxGeometry(70, 10, 9);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(-15,5,12);
    mesh.name = 'collisionBox1'; // Give the mesh a name to reference it later
    this._scene.add(mesh);
    mesh.boundingBox = new THREE.Box3().setFromObject(mesh);

    const geometry1 = new THREE.BoxGeometry(70, 10, 9);
    const mesh1 = new THREE.Mesh(geometry1, material);
    mesh1.position.set(-15,5,-15);
    mesh1.name = 'collisionBox2'; // Give the mesh a name to reference it later
    this._scene.add(mesh1);
    mesh1.boundingBox = new THREE.Box3().setFromObject(mesh1);

    const geometry2 = new THREE.BoxGeometry(10, 10, 30);
    const mesh2 = new THREE.Mesh(geometry2, material);
    mesh2.position.set(-55,5,0);
    mesh2.name = 'collisionBox3'; // Give the mesh a name to reference it later
    this._scene.add(mesh2);
    mesh2.boundingBox = new THREE.Box3().setFromObject(mesh2);

    const geometry3 = new THREE.BoxGeometry(6, 3, 6);
    const mesh3 = new THREE.Mesh(geometry3, material);
    mesh3.position.set(-40,1,-7);
    mesh3.name = 'collisionBox4'; // Give the mesh a name to reference it later
    this._scene.add(mesh3);
    mesh3.boundingBox = new THREE.Box3().setFromObject(mesh3);

    const geometry4 = new THREE.BoxGeometry(1, 4, 1);
    const mesh4 = new THREE.Mesh(geometry4, material);
    mesh4.position.set(-39.7,2,6.5);
    mesh4.name = 'collisionBox5'; // Give the mesh a name to reference it later
    this._scene.add(mesh4);
    mesh4.boundingBox = new THREE.Box3().setFromObject(mesh4);

    const geometry5 = new THREE.BoxGeometry(5, 2, 11);
    const mesh5 = new THREE.Mesh(geometry5, material);
    mesh5.position.set(-27,1,5.5);
    mesh5.name = 'collisionBox6'; // Give the mesh a name to reference it later
    this._scene.add(mesh5);
    mesh5.boundingBox = new THREE.Box3().setFromObject(mesh5);

    const geometry6 = new THREE.BoxGeometry(2, 1, 4);
    const mesh6 = new THREE.Mesh(geometry6, material);
    mesh6.position.set(-30,0.5,-8.3);
    mesh6.name = 'collisionBox7'; // Give the mesh a name to reference it later
    this._scene.add(mesh6);
    mesh6.boundingBox = new THREE.Box3().setFromObject(mesh6);

    const geometry7 = new THREE.BoxGeometry(1, 4, 1);
    const mesh7 = new THREE.Mesh(geometry7, material);
    mesh7.position.set(-13.7,2,6.5);
    mesh7.name = 'collisionBox8'; // Give the mesh a name to reference it later
    this._scene.add(mesh7);
    mesh7.boundingBox = new THREE.Box3().setFromObject(mesh7);

    const geometry8 = new THREE.BoxGeometry(3.4, 1, 5.3);
    const mesh8 = new THREE.Mesh(geometry8, material);
    mesh8.position.set(-15,0.5,-6.3);
    mesh8.name = 'collisionBox9'; // Give the mesh a name to reference it later
    this._scene.add(mesh8);
    mesh8.boundingBox = new THREE.Box3().setFromObject(mesh8);

    const geometry9 = new THREE.BoxGeometry(8, 2, 5);
    const mesh9 = new THREE.Mesh(geometry9, material);
    mesh9.position.set(-5,1,4.6);
    mesh9.name = 'collisionBox10'; // Give the mesh a name to reference it later
    this._scene.add(mesh9);
    mesh9.boundingBox = new THREE.Box3().setFromObject(mesh9);

    const geometry10 = new THREE.BoxGeometry(8, 2, 5);
    const mesh10 = new THREE.Mesh(geometry10, material);
    mesh10.position.set(22,1,9);
    mesh10.name = 'collisionBox11'; // Give the mesh a name to reference it later
    this._scene.add(mesh10);
    mesh10.boundingBox = new THREE.Box3().setFromObject(mesh10)

    const geometry11 = new THREE.BoxGeometry(8, 2, 5);
    const mesh11 = new THREE.Mesh(geometry11, material);
    mesh11.position.set(22,1,-10);
    mesh11.name = 'collisionBox12'; // Give the mesh a name to reference it later
    this._scene.add(mesh11);
    mesh11.boundingBox = new THREE.Box3().setFromObject(mesh11);

    const geometry12 = new THREE.BoxGeometry(40, 4, 20);
    const mesh12 = new THREE.Mesh(geometry12, material);
    mesh12.position.set(40,2,20);
    mesh12.name = 'collisionBox13'; // Give the mesh a name to reference it later
    this._scene.add(mesh12);
    mesh12.boundingBox = new THREE.Box3().setFromObject(mesh12);

    const geometry13 = new THREE.BoxGeometry(40, 4, 20);
    const mesh13 = new THREE.Mesh(geometry13, material);
    mesh13.position.set(40,2,-20);
    mesh13.name = 'collisionBox14'; // Give the mesh a name to reference it later
    this._scene.add(mesh13);
    mesh13.boundingBox = new THREE.Box3().setFromObject(mesh13);

    const geometry14 = new THREE.BoxGeometry(20, 4, 20);
    const mesh14 = new THREE.Mesh(geometry14, material);
    mesh14.position.set(50,2,0);
    mesh14.name = 'collisionBox15'; // Give the mesh a name to reference it later
    this._scene.add(mesh14);
    mesh14.boundingBox = new THREE.Box3().setFromObject(mesh14);
    

    
    const bump = new THREE.TextureLoader().load('resources/moon/Textures/Bump_2K.png');
    const diffuse = new THREE.TextureLoader().load('resources/moon/Textures/Diffuse_2K.png');

const moonMaterial = new THREE.MeshStandardMaterial({
    map: diffuse,
    bumpMap: bump,
    bumpScale: 0.05 // Adjust the bump scale as needed
});


    const moonPivot = new THREE.Group(); // Create a pivot group for the moon
    this._scene.add(moonPivot);

new MTLLoader()
.setPath( 'resources/moon/' )
.load( 'Moon 2K.mtl', function ( materials ) {

materials.preload();

new OBJLoader()
    .setMaterials( materials )
    .setPath( 'resources/moon/' )
    .load( 'Moon 2K.obj', function ( object ) {
            moonPivot.add(object); 
            // plane.add( object );
            object.scale.set(2,2,2);
            object.position.set(30,30,-30);
            object.rotation.set(0, 1.6, 0);
            object.add(directionalLight);
            object.add(directionalLight.target);
            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = false;
                    child.receiveShadow = true;
                    child.material = moonMaterial;
                    
                }
            } );
        } );
} );


new MTLLoader()
.setPath( 'resources/rumah/' )
.load( 'house2.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/rumah/' )
        .load( 'house2.obj', function ( object ) {
                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(-10,12,0);
                object.rotation.set(-Math.PI/2,Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/rumah/' )
.load( 'house2.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/rumah/' )
        .load( 'house2.obj', function ( object ) {
                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(-1,12,0);
                object.rotation.set(-Math.PI/2,Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/rumah/' )
.load( 'house2.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/rumah/' )
        .load( 'house2.obj', function ( object ) {
                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(-1,-14,0);
                object.rotation.set(-Math.PI/2,-Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );


    new MTLLoader()
.setPath( 'resources/rumah/' )
.load( 'house2.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/rumah/' )
        .load( 'house2.obj', function ( object ) {
                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(-50,-9,0);
                object.rotation.set(-Math.PI/2,0,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );


    new MTLLoader()
.setPath( 'resources/rumah/' )
.load( 'house2.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/rumah/' )
        .load( 'house2.obj', function ( object ) {
                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(-37,12,0);
                object.rotation.set(-Math.PI/2,Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/rumah/' )
.load( 'house2.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/rumah/' )
        .load( 'house2.obj', function ( object ) {
                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(-37,-14,0);
                object.rotation.set(-Math.PI/2,-Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );
    
new MTLLoader()
.setPath( 'resources/house3/' )
.load( 'house3.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house3/' )
        .load( 'house3.obj', function ( object ) {

                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(-19,12,0);
                object.rotation.set(-Math.PI/2,Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house3/' )
.load( 'house3.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house3/' )
        .load( 'house3.obj', function ( object ) {

                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(8,12,0);
                object.rotation.set(-Math.PI/2,Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house3/' )
.load( 'house3.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house3/' )
        .load( 'house3.obj', function ( object ) {

                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(17,-14,0);
                object.rotation.set(-Math.PI/2,-Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house3/' )
.load( 'house3.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house3/' )
        .load( 'house3.obj', function ( object ) {

                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(-28,-14,0);
                object.rotation.set(-Math.PI/2,-Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house3/' )
.load( 'house3.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house3/' )
        .load( 'house3.obj', function ( object ) {

                plane.add( object );
                object.scale.set(2.4,2.4,2.4);
                object.position.set(-19,-14,0);
                object.rotation.set(-Math.PI/2,-Math.PI/2,0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
    .setPath( 'resources/house3/' )
    .load( 'house3.mtl', function ( materials ) {
    
        materials.preload();
    
        new OBJLoader()
            .setMaterials( materials )
            .setPath( 'resources/house3/' )
            .load( 'house3.obj', function ( object ) {
    
                    plane.add( object );
                    object.scale.set(2.4,2.4,2.4);
                    object.position.set(-46,12,0);
                    object.rotation.set(-Math.PI/2,Math.PI/2,0);
                    object.traverse( function ( child ) {
                        if ( child.isMesh ) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    } );
                } );
        } );

    new MTLLoader()
.setPath( 'resources/house1/' )
.load( 'house1.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house1/' )
        .load( 'house1.obj', function ( object ) {

            plane.add( object );
            object.scale.set(0.6,0.6,0.6);
            object.position.set(-28,12,0);
            object.rotation.set(-Math.PI/2,0,0);
            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house1/' )
.load( 'house1.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house1/' )
        .load( 'house1.obj', function ( object ) {

            plane.add( object );
            object.scale.set(0.6,0.6,0.6);
            object.position.set(8,-14,0);
            object.rotation.set(-Math.PI/2,Math.PI,0);
            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house1/' )
.load( 'house1.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house1/' )
        .load( 'house1.obj', function ( object ) {

            plane.add( object );
            object.scale.set(0.6,0.6,0.6);
            object.position.set(17,12,0);
            object.rotation.set(-Math.PI/2,0,0);
            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house1/' )
.load( 'house1.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house1/' )
        .load( 'house1.obj', function ( object ) {

            plane.add( object );
            object.scale.set(0.6,0.6,0.6);
            object.position.set(-50,9,0);
            object.rotation.set(-Math.PI/2,-Math.PI/2,0);
            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house1/' )
.load( 'house1.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house1/' )
        .load( 'house1.obj', function ( object ) {

            plane.add( object );
            object.scale.set(0.6,0.6,0.6);
            object.position.set(-50,0,0);
            object.rotation.set(-Math.PI/2,-Math.PI/2,0);
            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house1/' )
.load( 'house1.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house1/' )
        .load( 'house1.obj', function ( object ) {

            plane.add( object );
            object.scale.set(0.6,0.6,0.6);
            object.position.set(-46,-14,0);
            object.rotation.set(-Math.PI/2,-Math.PI,0);
            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/house1/' )
.load( 'house1.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/house1/' )
        .load( 'house1.obj', function ( object ) {

            plane.add( object );
            object.scale.set(0.6,0.6,0.6);
            object.position.set(-10,-14,0);
            object.rotation.set(-Math.PI/2,-Math.PI,0);
            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/nimrud/' )
.load( 'nimrud.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/nimrud/' )
        .load( 'nimrud.obj', function ( object ) {

                plane.add( object );
                object.scale.set(0.7,0.7,0.7);
                object.position.set(-6,5,-0.4);
                object.rotation.set(3.15, 0, -1.1);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/nimrud/' )
.load( 'nimrud.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/nimrud/' )
        .load( 'nimrud.obj', function ( object ) {

                plane.add( object );
                object.scale.set(0.7,0.7,0.7);
                object.position.set(21,-10,-1.3);
                object.rotation.set(0, 0, -1.1);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/nimrud/' )
.load( 'nimrud.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/nimrud/' )
        .load( 'nimrud.obj', function ( object ) {

                plane.add( object );
                object.scale.set(0.7,0.7,0.7);
                object.position.set(-27,8.6,-0.4);
                object.rotation.set(Math.PI, 0, Math.PI/5);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/nimrud/' )
.load( 'nimrud.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/nimrud/' )
        .load( 'nimrud.obj', function ( object ) {

                plane.add( object );
                object.scale.set(0.7,0.7,0.7);
                object.position.set(-27,3,-0.4);
                object.rotation.set(Math.PI, 0, -Math.PI/5);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/nimrud/' )
.load( 'nimrud.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/nimrud/' )
        .load( 'nimrud.obj', function ( object ) {

                plane.add( object );
                object.scale.set(0.7,0.7,0.7);
                object.position.set(-40,-7,-0.4);
                object.rotation.set(Math.PI, 0, -Math.PI/5);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );


    new MTLLoader()
.setPath( 'resources/Wooden_Pallet/' )
.load( 'Wooden_Pallet.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/Wooden_Pallet/' )
        .load( 'Wooden_Pallet.obj', function ( object ) {

                plane.add( object );
                object.scale.set(1.5,1.5,1.5);
                object.position.set(-3,3,-0.7);
                object.rotation.set(0.7, 1, 0.5);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/Wooden_Pallet/' )
.load( 'Wooden_Pallet.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/Wooden_Pallet/' )
        .load( 'Wooden_Pallet.obj', function ( object ) {

                plane.add( object );
                object.scale.set(2,2,2);
                object.position.set(-30,-8,-0.4);
                object.rotation.set(Math.PI/2, 0, 0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );
            } );
    } );


    new MTLLoader()
.setPath( 'resources/Medieval Town (base)/Models/' )
.load( 'Lightpost_01.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/Medieval Town (base)/Models/' )
        .load( 'Lightpost_01.obj', function ( objectLight ) {

                plane.add( objectLight );
                objectLight.scale.set(1.5,1.5,1.5);
                objectLight.position.set(-40,7,0);
                objectLight.rotation.set(-Math.PI/2, 0, 0);
                objectLight.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                    var postLight = new THREE.PointLight(0xFFFFFF, 50, 1000); // color, intensity, distance
                    postLight.position.set(0, 3.5, 0); // Adjust position relative to the light post
                    objectLight.add(postLight); // Add the light as a child of the light post
                } );
            } );
    } );


    new MTLLoader()
.setPath( 'resources/Medieval Town (base)/Models/' )
.load( 'Lightpost_01.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/Medieval Town (base)/Models/' )
        .load( 'Lightpost_01.obj', function ( objectLight ) {

                plane.add( objectLight );
                objectLight.scale.set(1.5,1.5,1.5);
                objectLight.position.set(-40,-9,0);
                objectLight.rotation.set(-Math.PI/2, 0, 0);
                objectLight.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                    var postLight = new THREE.PointLight(0xFFFFFF, 50, 1000); // color, intensity, distance
                    postLight.position.set(0, 3.5, 0); // Adjust position relative to the light post
                    objectLight.add(postLight); // Add the light as a child of the light post
                } );
            } );
    } );


    new MTLLoader()
.setPath( 'resources/Medieval Town (base)/Models/' )
.load( 'Lightpost_01.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/Medieval Town (base)/Models/' )
        .load( 'Lightpost_01.obj', function ( objectLight ) {

                plane.add( objectLight );
                objectLight.scale.set(1.5,1.5,1.5);
                objectLight.position.set(-14, -9, 0);
                objectLight.rotation.set(0, 0, Math.PI/6);
                objectLight.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                    var postLight = new THREE.PointLight(0xFFFFFF, 100, 1000); // color, intensity, distance
                    postLight.position.set(0, 3.5, 0); // Adjust position relative to the light post
                    objectLight.add(postLight); // Add the light as a child of the light post
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/Medieval Town (base)/Models/' )
.load( 'Lightpost_01.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/Medieval Town (base)/Models/' )
        .load( 'Lightpost_01.obj', function ( objectLight ) {

                plane.add( objectLight );
                objectLight.scale.set(1.5,1.5,1.5);
                objectLight.position.set(-14, 7, 0);
                objectLight.rotation.set(-Math.PI/2, 0, 0);
                objectLight.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                    var postLight = new THREE.PointLight(0xFFFFFF, 100, 1000); // color, intensity, distance
                    postLight.position.set(0, 3.5, 0); // Adjust position relative to the light post
                    objectLight.add(postLight); // Add the light as a child of the light post
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/Medieval Town (base)/Models/' )
.load( 'Lightpost_01.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/Medieval Town (base)/Models/' )
        .load( 'Lightpost_01.obj', function ( objectLight ) {

                plane.add( objectLight );
                objectLight.scale.set(1.5,1.5,1.5);
                objectLight.position.set(18, 7, 0);
                objectLight.rotation.set(0, 0, -Math.PI/6);
                objectLight.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                    var postLight = new THREE.PointLight(0xFFFFFF, 100, 1000); // color, intensity, distance
                    postLight.position.set(0, 3.5, 0); // Adjust position relative to the light post
                    objectLight.add(postLight); // Add the light as a child of the light post
                } );
            } );
    } );

    new MTLLoader()
.setPath( 'resources/Medieval Town (base)/Models/' )
.load( 'Lightpost_01.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/Medieval Town (base)/Models/' )
        .load( 'Lightpost_01.obj', function ( objectLight ) {

                plane.add( objectLight );
                objectLight.scale.set(1.5,1.5,1.5);
                objectLight.position.set(20, -7.4, 0.4);
                objectLight.rotation.set(-4*Math.PI/6, Math.PI/6, 0);
                objectLight.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                    var postLight = new THREE.PointLight(0xFFFFFF, 100, 1000); // color, intensity, distance
                    postLight.position.set(0, 3.5, 0); // Adjust position relative to the light post
                    objectLight.add(postLight); // Add the light as a child of the light post
                } );
            } );
    } );

    


    const b1 = new THREE.TextureLoader().load('resources/barrier/images.jpg');
    const b2 = new THREE.TextureLoader().load('resources/barrier/hrt_lost_taken_rust_7.jpg');
    const b3 = new THREE.TextureLoader().load('resources/barrier/road_barrier.png');

    const barrierMaterials = {
        'images': new THREE.MeshStandardMaterial({ map: b1 }),
        'hrt_lost_taken_rust_7': new THREE.MeshStandardMaterial({ map: b2 }),
        'road_barrier': new THREE.MeshStandardMaterial({ map: b3 })
    };

    new MTLLoader()
.setPath( 'resources/barrier/' )
.load( 'road barrier.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/barrier/' )
        .load( 'road barrier.obj', function ( object ) {

            plane.add( object );
            object.scale.set(0.2,0.2,0.2);
            object.position.set(23,10,0);
            object.rotation.set(-Math.PI/2,-Math.PI/5,0);
            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material.map = b2 , b1;
                    
                    }
                } );
            } );
    } );


    new MTLLoader()
.setPath( 'resources/helicopter/' )
.load( 'Seahawk.mtl', function ( materials ) {

    materials.preload();

    new OBJLoader()
        .setMaterials( materials )
        .setPath( 'resources/helicopter/' )
        .load( 'SeaHawk.obj', function ( object ) {

                plane.add( object );
                object.scale.set(0.14,0.14,0.14);
                object.position.set(45,0,0);
                object.rotation.set(-Math.PI/2, 0, 0);
                object.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (helicopterMaterials[child.name]) {
                            child.material = helicopterMaterials[child.name];
                        }                       
                    }
                } );
            } );
    } );


    // Load texture metal fence
    
    const baseColorFence = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_BaseColor.png');
    const heightFence = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_Height.png');
    const metallicFence = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_Metallic.png');
    const normalFence = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_Normal.png');
    const roughnessFence = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_Roughness.png');

    const baseColorFenceBody = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_FenceBody_BaseColor.png');
    const heightFenceBody = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_FenceBody_Height.png');
    const metallicFenceBody = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_FenceBody_Metallic.png');
    const normalFenceBody = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_FenceBody_Normal.png');
    const roughnessFenceBody = new THREE.TextureLoader().load('resources/metal_fence/metal_fence_texture/Fence_FenceBody_Roughness.png');

const materialFence = new THREE.MeshStandardMaterial({
    map: baseColorFence,
    displacementMap: heightFence,
    metalnessMap: metallicFence,
    normalMap: normalFence,
    roughnessMap: roughnessFence,
    displacementScale: 0.1, // Adjust the scale as needed
});

const materialFenceBody = new THREE.MeshStandardMaterial({
    map: baseColorFenceBody,
    displacementMap: heightFenceBody,
    metalnessMap: metallicFenceBody,
    normalMap: normalFenceBody,
    roughnessMap: roughnessFenceBody,
    displacementScale: 0.1, // Adjust the scale as needed
});



new MTLLoader()
.setPath('resources/metal_fence/')
.load('Metal_Fence.mtl', function (materials) {
    materials.preload();

    new OBJLoader()
        .setMaterials(materials)
        .setPath('resources/metal_fence/')
        .load('Metal_Fence.obj', function (object) {
            plane.add(object);
            object.scale.set(0.02, 0.01, 0.01);
            object.position.set(29, -15, 0);
            object.rotation.set(-Math.PI/2, -Math.PI/1.4, 0);
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                        child.material = materialFenceBody;
                        child.material = materialFence;
                    
                }
            });
        });
});

new MTLLoader()
.setPath('resources/metal_fence/')
.load('Metal_Fence.mtl', function (materials) {
    materials.preload();

    new OBJLoader()
        .setMaterials(materials)
        .setPath('resources/metal_fence/')
        .load('Metal_Fence.obj', function (object) {
            plane.add(object);
            object.scale.set(0.02, 0.01, 0.01);
            object.position.set(40.5, -20.7, 0);
            object.rotation.set(-Math.PI/2, 0, 0);
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                        child.material = materialFenceBody;
                        child.material = materialFence;
                    
                }
            });
        });
});


new MTLLoader()
.setPath('resources/metal_fence/')
.load('Metal_Fence.mtl', function (materials) {
    materials.preload();

    new OBJLoader()
        .setMaterials(materials)
        .setPath('resources/metal_fence/')
        .load('Metal_Fence.obj', function (object) {
            plane.add(object);
            object.scale.set(0.02, 0.01, 0.01);
            object.position.set(40.5, 20.7, 0);
            object.rotation.set(-Math.PI/2, 6*Math.PI/7, 0);
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                        child.material = materialFenceBody;
                        child.material = materialFence;
                    
                }
            });
        });
});


new MTLLoader()
.setPath('resources/metal_fence/')
.load('Metal_Fence.mtl', function (materials) {
    materials.preload();

    new OBJLoader()
        .setMaterials(materials)
        .setPath('resources/metal_fence/')
        .load('Metal_Fence.obj', function (object) {
            plane.add(object);
            object.scale.set(0.02, 0.01, 0.01);
            object.position.set(30, 14, 0);
            object.rotation.set(-Math.PI/2, -Math.PI/4, 0);
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                        child.material = materialFenceBody;
                        child.material = materialFence;
                    
                }
            });
        });
});

new MTLLoader()
.setPath('resources/metal_fence/')
.load('Metal_Fence.mtl', function (materials) {
    materials.preload();

    new OBJLoader()
        .setMaterials(materials)
        .setPath('resources/metal_fence/')
        .load('Metal_Fence.obj', function (object) {
            plane.add(object);
            object.scale.set(0.02, 0.01, 0.01);
            object.position.set(52, 18, 0);
            object.rotation.set(-Math.PI/2, -3*Math.PI/4, 0);
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                        child.material = materialFenceBody;
                        child.material = materialFence;
                    
                }
            });
        });
});

new MTLLoader()
.setPath('resources/metal_fence/')
.load('Metal_Fence.mtl', function (materials) {
    materials.preload();

    new OBJLoader()
        .setMaterials(materials)
        .setPath('resources/metal_fence/')
        .load('Metal_Fence.obj', function (object) {
            plane.add(object);
            object.scale.set(0.02, 0.01, 0.01);
            object.position.set(51, -15, 0);
            object.rotation.set(-Math.PI/2, -Math.PI/4, 0);
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                        child.material = materialFenceBody;
                        child.material = materialFence;
                    
                }
            });
        });
});

new MTLLoader()
.setPath('resources/metal_fence/')
.load('Metal_Fence.mtl', function (materials) {
    materials.preload();

    new OBJLoader()
        .setMaterials(materials)
        .setPath('resources/metal_fence/')
        .load('Metal_Fence.obj', function (object) {
            plane.add(object);
            object.scale.set(0.034, 0.01, 0.01);
            object.position.set(56, 0, 0);
            object.rotation.set(-Math.PI/2, -Math.PI/2, 0);
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                        child.material = materialFenceBody;
                        child.material = materialFence;
                    
                }
            });
        });
});


const loadZombie = new FBXLoader();
loadZombie.load('resources/zombie/Zombie Idle.fbx', (object) => {
    this._mixer2 = new THREE.AnimationMixer(object);
    const action = this._mixer2.clipAction(object.animations[0]);
    action.play();
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    plane.add(object);

    object.scale.set(0.015, 0.015, 0.015);
    object.rotation.set(-Math.PI/2,0,0);
    object.position.set(-30, 3, 0);
    object.castShadow = true;
    object.receiveShadow = true;
});

const loadZombie2 = new FBXLoader();
loadZombie2.load('resources/zombie/Zombie Idle.fbx', (object) => {
    this._mixer3 = new THREE.AnimationMixer(object);
    const action = this._mixer3.clipAction(object.animations[0]);
    action.play();
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    plane.add(object);

    object.scale.set(0.015, 0.015, 0.015);
    object.rotation.set(-Math.PI/2,-0.7,0);
    object.position.set(-18, -7, 0);
    object.castShadow = true;
    object.receiveShadow = true;
});


const loadZombie3 = new FBXLoader();
loadZombie3.load('resources/zombie/Zombie Idle.fbx', (object) => {
    this._mixer4 = new THREE.AnimationMixer(object);
    const action = this._mixer4.clipAction(object.animations[0]);
    action.play();
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    plane.add(object);

    object.scale.set(0.015, 0.015, 0.015);
    object.rotation.set(-Math.PI/2,-2,0);
    object.position.set(-10, 4, 0);
    object.castShadow = true;
    object.receiveShadow = true;
});

const loadZombie4 = new FBXLoader();
loadZombie4.load('resources/zombie/Zombie Idle.fbx', (object) => {
    this._mixer5 = new THREE.AnimationMixer(object);
    const action = this._mixer5.clipAction(object.animations[0]);
    action.play();
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    plane.add(object);

    object.scale.set(0.015, 0.015, 0.015);
    object.rotation.set(-Math.PI/2,-Math.PI/3,0);
    object.position.set(3, 4, 0);
    object.castShadow = true;
    object.receiveShadow = true;
});

const loadZombie5 = new FBXLoader();
loadZombie5.load('resources/zombie/Zombie Idle.fbx', (object) => {
    this._mixer6 = new THREE.AnimationMixer(object);
    const action = this._mixer6.clipAction(object.animations[0]);
    action.play();
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    plane.add(object);

    object.scale.set(0.015, 0.015, 0.015);
    object.rotation.set(-Math.PI/2,Math.PI/4,0);
    object.position.set(3, 2, 0);
    object.castShadow = true;
    object.receiveShadow = true;
});

const loadZombie6 = new FBXLoader();
loadZombie6.load('resources/zombie/Zombie Idle.fbx', (object) => {
    this._mixer7 = new THREE.AnimationMixer(object);
    const action = this._mixer7.clipAction(object.animations[0]);
    action.play();
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    plane.add(object);

    object.scale.set(0.015, 0.015, 0.015);
    object.rotation.set(-Math.PI/2,-Math.PI/7,0);
    object.position.set(2, -3.7, 0);
    object.castShadow = true;
    object.receiveShadow = true;
});

const loadZombie7 = new FBXLoader();
loadZombie7.load('resources/zombie/Zombie Idle.fbx', (object) => {
    this._mixer8 = new THREE.AnimationMixer(object);
    const action = this._mixer8.clipAction(object.animations[0]);
    action.play();
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    plane.add(object);

    object.scale.set(0.5, 0.5, 0.5);
    object.rotation.set(-Math.PI/2,-Math.PI/2,0);
    object.position.set(100, 0, 40);
    object.castShadow = true;
    object.receiveShadow = true;
});



// const loader = new THREE.TextureLoader();
// const texture = loader.load('./resources/background.jpg', (texture) => {
//   texture.encoding = THREE.sRGBEncoding;
//   texture.mapping = THREE.EquirectangularReflectionMapping; // This mapping is for equirectangular panoramas

//   this._scene.background = texture;
//   this._scene.environment = texture; // Optional: Set the same texture for scene environment
// });


    this._LoadAnimatedModel();
    this._RAF();

    this._freeRoamCamera = new FreeRoamCamera({
      camera: this._camera,
      scene: this._scene,
      input: this._controls._input, // Pass input handler to FreeRoamCamera
      disableThirdPersonCamera: () => this._disableThirdPersonCamera(),
      enableThirdPersonCamera: () => this._enableThirdPersonCamera(),
    });
    this._moonPivot = moonPivot;
  }

  _disableThirdPersonCamera() {
    if (this._thirdPersonCamera) {
      this._thirdPersonCamera.disable();
    }
  }

  _enableThirdPersonCamera() {
    if (this._thirdPersonCamera) {
      this._thirdPersonCamera.enable();
    }
  }

  _LoadAnimatedModel() {
    const params = {
      camera: this._camera,
      scene: this._scene,
    }
    this._controls = new BasicCharacterController(params);

    this._thirdPersonCamera = new ThirdPersonCamera({
      camera: this._camera,
      target: this._controls,
    });
  }

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();
      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }


  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map(m => m.update(timeElapsedS));
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }

    const delta = this._clock.getDelta();
    if ( this._mixer2 ) this._mixer2.update(delta);
    if ( this._mixer3 ) this._mixer3.update(delta);
    if ( this._mixer4 ) this._mixer4.update(delta);
    if ( this._mixer5 ) this._mixer5.update(delta);
    if ( this._mixer6 ) this._mixer6.update(delta);
    if ( this._mixer7 ) this._mixer7.update(delta);

    this._thirdPersonCamera.Update(timeElapsedS);

    this._freeRoamCamera.Update(timeElapsed);

    this._UpdateMoonOrbit(timeElapsedS);
  }

  _UpdateMoonOrbit(timeElapsedS) {
    if (this._moonPivot) {
      this._moonPivot.rotation.y += timeElapsedS * 0.1; // Adjust rotation speed as needed
    }
  }
}


let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new Demo();
});


function _LerpOverFrames(frames, t) {
  const s = new THREE.Vector3(0, 0, 0);
  const e = new THREE.Vector3(100, 0, 0);
  const c = s.clone();

  for (let i = 0; i < frames; i++) {
    c.lerp(e, t);
  }
  return c;
}

function _TestLerp(t1, t2) {
  const v1 = _LerpOverFrames(100, t1);
  const v2 = _LerpOverFrames(50, t2);
  console.log(v1.x + ' | ' + v2.x);
}

_TestLerp(0.01, 0.01);
_TestLerp(1.0 / 100.0, 1.0 / 50.0);
_TestLerp(1.0 - Math.pow(0.3, 1.0 / 100.0), 
          1.0 - Math.pow(0.3, 1.0 / 50.0));