import * as THREE from "three";
import * as OBC from 'openbim-components';
import {FragmentMesh, FragmentsGroup} from 'bim-fragment';
import { cullerUpdater } from './culler-updater';
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MeshBVH } from 'three-mesh-bvh';

const params = {
	gridSize: 0.7,
	boxSize: 0.7,
	boxRoundness: 0.01
}

export class ModelLoader {
	public _dragDrop: OBC.DragAndDropInput;
	private _components: OBC.Components;
	private _loadingModal: OBC.Modal;
	private _blurScreen: OBC.SimpleUIComponent;
	private _raycaster: THREE.Raycaster;

	constructor(components: OBC.Components) {
		this._components = components;
		this._components.raycaster = new OBC.SimpleRaycaster(components)
		this._raycaster = this._components.raycaster.get();
		this._loadingModal = this.setupLoadingModal();
		this._blurScreen = this.setupBlurScreen();
		this._dragDrop = this.setupDragDrop();
	}

	private setupBlurScreen() {
		const blurScreen = new OBC.SimpleUIComponent(this._components);
		blurScreen.domElement.className = 'fixed top-0 bottom-0 right-0 left-0';
		blurScreen.domElement.style.backdropFilter = 'blur(5px)';
		blurScreen.domElement.style.zIndex = '999';
		this._components.ui.add(blurScreen);

		const canvas = this._components.renderer.get().domElement;
		canvas.addEventListener('dragenter', () => {
			blurScreen.visible = true;
		});

		return blurScreen;
	}

	private setupDragDrop() {
		const dragDrop = new OBC.DragAndDropInput(this._components);
		dragDrop.domElement.style.top = '8rem';
		dragDrop.domElement.style.bottom = '16rem';
		dragDrop.domElement.style.left = '12rem';
		dragDrop.domElement.style.right = '12rem';
		this._blurScreen.addChild(dragDrop);

		dragDrop.domElement.addEventListener('click', () => {
			// TODO: Add this click opening logic to the library
			const opener = document.createElement('input');
			opener.type = 'file';
			opener.multiple = true;
			opener.onchange = async () => {
				if (opener.files) {
					await this.openFiles(opener.files);
					opener.remove();
				}
			}
			opener.click();
		});

		dragDrop.onFilesLoaded.add(this.openFiles);

		return dragDrop;
	}

	private openFiles = async (files: FileList) => {
		if (files.length === 0) {
			return;
		}
		this._blurScreen.visible = false;
		const scene = this._components.scene.get();

		// const cacher = await this._components.tools.get(OBC.FragmentCacher);
		const highlighter = await this._components.tools.get(OBC.FragmentHighlighter);
		// const fragments = await this._components.tools.get(OBC.FragmentManager);

		// TODO: Why is this necessary? Investigate why the highlighter is reset
		if (!Object.keys(highlighter.highlightMats).length) {
			await highlighter.setup();
		}

		let fileLoaded = false;
		// @ts-ignore
		highlighter.enabled = false;

		for (const index in files) {
			const file = files[index];
			const { name, size } = file;

			if (!size || !name || !name.match(/.ifc$/)) {
				continue;
			}

			fileLoaded = true;
			this._loadingModal.visible = true;

			// If file is cached, just load the fragment

			// const fileURL = URL.createObjectURL(file);

			// const fileID = JSON.stringify({ name, size });
			// const isCached = cacher.existsFragmentGroup(fileID);
			// if (isCached) {
			// 	const model = await cacher.getFragmentGroup(fileID);
			// 	if (model) {
			// 		// TODO: Do this in fragmentManager automatically?
			// 		const isFirstModel = fragments.groups.length === 1;
			// 		if (isFirstModel) {
			// 			fragments.baseCoordinationModel = model.uuid;
			// 		} else {
			// 			fragments.coordinate([model]);
			// 		}
			// 		// Save the IFC for later export
			// 		await cacher.delete([model.uuid]);
			// 		await cacher.save(model.uuid, fileURL);
			// 		await this.setupLoadedModel(model);
			// 	}
			// 	continue;
			// }
			// Otherwise load the IFC and cache it

			const rawBuffer = await file.arrayBuffer();
			const buffer = new Uint8Array(rawBuffer);
			const loader = await this._components.tools.get(OBC.FragmentIfcLoader);
			const model = await loader.load(buffer, file.name);



			// Save the IFC for later export
			// await cacher.delete([model.uuid]);
			// await cacher.save(model.uuid, fileURL);

			await this.setupLoadedModel(model);

			console.log('model', model)

			// if (!isCached) {
			// 	await cacher.saveFragmentGroup(model, fileID);
			// }
			// if (model.items.length > 1) {
			// 	let modelVoxel = this.voxelizeModel(model.items[1].mesh)
			// 	let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			// 	scene.add(mesh)
			// 	scene.add(model.items[0].mesh)
			// } else {

			// let modelVoxel = this.newVoxelizeModel(model.items[1].mesh)
			// // let modelVoxel = this.voxelizeModel(model.items[i].mesh)
			// // modelVoxel = this.fillVoxelModel(model.items[i].mesh, modelVoxel);
			// let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			// scene.add(mesh)

			const timestampStart = new Date().getTime();
			// for (let i = 0; i < model.items.length; i++) {
			// 	// TODO: check capacity
			// 	if (model.items[i].capacity === 1) {
			// 		let voxelTask = this.newVoxelizeModel(model.items[i].mesh as FragmentMesh)
			// 		const arr = []
			// 		for (const item of voxelTask) {
			// 			arr.push(item)
			// 		}
			// 		let mesh = this.recreateInstancedMesh(arr, arr.length)
			// 		scene.add(mesh)
			// 	}
			// }
			const timestampEnd = new Date().getTime();
			console.log(`Success took ${timestampEnd - timestampStart} ms`)


			// model.items.map((item: any) => {
			// 	let modelVoxel = this.voxelizeModel(item.mesh)
			// 	let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			// 	scene.add(mesh)
			// })

			scene.add(model)
			// scene.add(model.items[1].mesh)
			// }

			// Tạo trục oxyz
		}

		// TODO: this is to prevent highlighting during load before coordination
		setTimeout(
			() => highlighter.enabled = true,
			1000
		)

		if (!fileLoaded) {
			this._blurScreen.visible = true;
			return;
		}
		this._loadingModal.visible = false;
	}


	private async setupLoadedModel(model: FragmentsGroup) {
		const tools = this._components.tools;
		const culler = await tools.get(OBC.ScreenCuller);
		const classifier = await tools.get(OBC.FragmentClassifier);
		const propsProcessor = await tools.get(OBC.IfcPropertiesProcessor);
		const highlighter = await tools.get(OBC.FragmentHighlighter);
		const grid = await tools.get(OBC.SimpleGrid);
		const styler = await tools.get(OBC.FragmentClipStyler);
		const plans = await tools.get(OBC.FragmentPlans);
		const materialManager = await tools.get(OBC.MaterialManager);
		const modelTree = await tools.get(OBC.FragmentTree);
		const hider = await tools.get(OBC.FragmentHider);

		for (const fragment of model.items) {
			culler.add(fragment.mesh);
		}

		classifier.byStorey(model);
		classifier.byEntity(model);

		await cullerUpdater.update();

		propsProcessor.process(model);
		await highlighter.update();

		const gridMesh = grid.get();
		const bottom = model.boundingBox.min.y;
		if (bottom < gridMesh.position.y) {
			gridMesh.position.y = bottom - 1;
		}

		await styler.update();

		await plans.computeAllPlanViews(model);
		await plans.updatePlansList();

		const meshes = model.items.map((frag: any) => frag.mesh);
		materialManager.addMeshes('white', meshes);
		await modelTree.update(['storeys', 'entities']);

		await hider.update();
	}

	private setupLoadingModal() {
		const loadingModal = new OBC.Modal(this._components, 'Loading model');
		this._components.ui.add(loadingModal);
		const modalContent = loadingModal.slots.actionButtons;
		for (const child of modalContent.children) {
			child.visible = false;
		}

		modalContent.domElement.classList.remove('justify-end');
		modalContent.domElement.classList.add('justify-start');

		const loadingMessage = '🚀 This should take a few moments...';
		const paragraph = `<p>${loadingMessage}</p>`;
		const text = new OBC.SimpleUIComponent(this._components, paragraph);
		loadingModal.slots.actionButtons.addChild(text);

		return loadingModal;
	}

	private* newVoxelizeModel(importedScene: any) {
		const importedMeshes: any = [];
		importedScene.traverse((child: any) => {
			if (child instanceof THREE.Mesh) {
				child.material.map((m: any) => ({...m, side: THREE.DoubleSide}))
				// child.material.side = THREE.DoubleSide;
				importedMeshes.push(child);
			}
		});
		let modelVoxels: any = [];

		const mesh = importedScene;
		const bvh = new MeshBVH(importedScene.geometry);

		const boundingBox = new THREE.Box3().setFromObject(mesh);
		const invMat = new THREE.Matrix4().copy( mesh.matrixWorld ).invert();

		const box = new THREE.Box3();

		const rayX = new THREE.Ray();
		rayX.direction.set( 1, 0, 0 );

		const rayY = new THREE.Ray();
		rayY.direction.set( 0, 1, 0 );

		const rayZ = new THREE.Ray();
		rayZ.direction.set( 0, 0, 1 );


		// Get size data
		const gridSize = params.gridSize;
		const boxSize = params.boxSize;
		for (let x = boundingBox.min.x ; x <= boundingBox.max.x ; x += gridSize) {
			for (let y = boundingBox.min.y ; y <= boundingBox.max.y; y += gridSize) {
				for (let z = boundingBox.min.z ; z <= boundingBox.max.z; z += gridSize) {
					// get position form center of voxel block
					const position = new THREE.Vector3(x + boxSize / 2, y + boxSize / 2, z + boxSize / 2);

					box.min.setScalar(-1*gridSize ).add( position );
					box.max.setScalar(gridSize).add( position );

					const res = bvh.intersectsBox( box, invMat );
					if (res) {
						modelVoxels.push({position: position}); // Thêm voxel vào mảng

						yield {position: position}
					} else {
						// transform into the local frame of the model
						rayX.origin.copy( position ).applyMatrix4( invMat );
						const resX = bvh.raycastFirst( rayX, THREE.DoubleSide );

						rayY.origin.copy( position ).applyMatrix4( invMat );
						const resY = bvh.raycastFirst( rayY, THREE.DoubleSide );

						rayZ.origin.copy( position ).applyMatrix4( invMat );
						const resZ = bvh.raycastFirst( rayZ, THREE.DoubleSide );

						if (

							resX && resX.face.normal.dot( rayX.direction ) > 0 &&
							resY && resY.face.normal.dot( rayY.direction ) > 0 &&
							resZ && resZ.face.normal.dot( rayZ.direction ) > 0

						) {
							modelVoxels.push({position: position}); // Thêm voxel vào mảng

							yield {position: position}
						}
					}
				}
			}
		}
		// return modelVoxels
	}


	private voxelizeModel(importedScene: FragmentMesh) {
		const importedMeshes: any = [];
		importedScene.traverse((child: any) => {
			if (child.type === 'Mesh') {
				child.material = child.material.map((m: any) => ({...m, side: THREE.DoubleSide}))
				// child.material[0].side = THREE.DoubleSide;
				importedMeshes.push(child);
			}
		});

		let modelVoxels: any = [];
		for (const mesh of importedMeshes) {
			const boundingBox = new THREE.Box3().setFromObject(mesh);

			// Get size data
			const gridSize = params.gridSize;
			const boxSize = params.boxSize;
			for (let x = boundingBox.min.x - gridSize; x <= boundingBox.max.x + gridSize; x += gridSize) {
				for (let y = boundingBox.min.y - gridSize; y <= boundingBox.max.y + gridSize; y += gridSize) {
					for (let z = boundingBox.min.z - gridSize; z <= boundingBox.max.z + gridSize; z += gridSize) {
						// get position form center of voxel block
						const centerPoint = new THREE.Vector3(x + boxSize, y + boxSize, z + boxSize);

						// this.testRenderCenterVoxel(centerPoint)
						if (
							this.isInsideMesh(centerPoint, new THREE.Vector3(0, -1, 0), mesh)
							|| this.isInsideMesh(centerPoint, new THREE.Vector3(1, 0, 0), mesh)
							|| this.isInsideMesh(centerPoint, new THREE.Vector3(0, 1, 0), mesh)
							|| this.isInsideMesh(centerPoint, new THREE.Vector3(0, 0, 1), mesh)
							|| this.isInsideMesh(centerPoint, new THREE.Vector3(-1, 0, 0), mesh)
							|| this.isInsideMesh(centerPoint, new THREE.Vector3(0, 0, -1), mesh)
						) {
							modelVoxels.push({ position: centerPoint });
						}
					}
				}
			}
		}

		return modelVoxels
	}

	private testRenderCenterVoxel(point: THREE.Vector3) {
		const dotGeometry = new THREE.BufferGeometry();
		dotGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([point.x,point.y,point.z]), 3));
		const dotMaterial = new THREE.PointsMaterial({ size: 0.05, color: 0xff0000 });
		const dot = new THREE.Points(dotGeometry, dotMaterial);

		const scene = this._components.scene.get();
		scene.add(dot)
	}

	private isInsideMesh(pos: any, ray: any, mesh: any) {
		const raycaster = new THREE.Raycaster();
		raycaster.set(pos, ray);
		let rayCasterIntersects = raycaster.intersectObject(mesh, false);
		return rayCasterIntersects.length > 0 && rayCasterIntersects[0].distance <= params.gridSize;
	}

	private recreateInstancedMesh(array: any, cnt: any) {
		console.log("cnt", cnt)
		// remove the old mesh and voxels data
		let instancedMesh,
			voxelGeometry = new RoundedBoxGeometry(params.boxSize, params.boxSize, params.boxSize, 2, params.boxRoundness),
			voxelMaterial = new THREE.MeshLambertMaterial({ opacity: 0.4, transparent: true }),
			dummy = new THREE.Object3D();

		// re-initiate the voxel array with random colors and positions
		// for (let i = 0; i < cnt; i++) {
		// 	voxels.push({
		// 		position: array[i].position,
		// 		color: array[i].color || new THREE.Color().setHSL(.4, .4, .4)
		// 	})
		// }

		// create a new instanced mesh object
		instancedMesh = new THREE.InstancedMesh(voxelGeometry, voxelMaterial, cnt);
		instancedMesh.castShadow = true;
		instancedMesh.receiveShadow = true;


		// assign voxels data to the instanced mesh
		for (let i = 0; i < cnt; i++) {
			instancedMesh.setColorAt(i, array[i].color || new THREE.Color().setHSL(.4, .4, .4));
			dummy.position.copy(array[i].position);
			dummy.updateMatrix();
			instancedMesh.setMatrixAt(i, dummy.matrix);
		}
		instancedMesh.instanceMatrix.needsUpdate = true;
		// instancedMesh.instanceColor.needsUpdate = true;

		// add a new mesh to the scene

		return instancedMesh
	}

	private arrayToMap(array: any) {
		return array.reduce(function (map: any, obj: any) {
			map[JSON.stringify(obj)] = true;
			return map;
		}, {});
	}
}