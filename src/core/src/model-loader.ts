import * as THREE from "three";
import * as OBC from 'openbim-components';
import { FragmentsGroup } from 'bim-fragment';
import { cullerUpdater } from './culler-updater';
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";

const paramsDefault = {
	boxRoundness: 0.01
}

export class ModelLoader {
	public _dragDrop: OBC.DragAndDropInput;
	private _components: OBC.Components;
	private _loadingModal: OBC.Modal;
	private _blurScreen: OBC.SimpleUIComponent;
	private currentMesh: any;
	private params: any = paramsDefault;
	private minGridSize: any

	constructor(components: OBC.Components) {
		this._components = components;
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

			console.log('model', model)
			const boundingBox = new THREE.Box3().setFromObject(model);
			let x = Math.abs(boundingBox.max.x - boundingBox.min.x)
			let y = Math.abs(boundingBox.max.y - boundingBox.min.y)
			let z = Math.abs(boundingBox.max.z - boundingBox.min.z)
			console.log("V", x * y * z)
			let range = Math.sqrt((x * y * z) / 6500).toFixed(1)
			this.params = {
				...paramsDefault,
				gridSize: parseFloat(range),
				boxSize: parseFloat(range),
			}
			this.minGridSize = parseFloat(range)
			// Save the IFC for later export
			// await cacher.delete([model.uuid]);
			// await cacher.save(model.uuid, fileURL);

			await this.setupLoadedModel(model);
			await this.voxelButton(model)

			// if (!isCached) {
			// 	await cacher.saveFragmentGroup(model, fileID);
			// }
			// if (model.items.length > 1) {
			// 	let modelVoxel = this.voxelizeModel(model.items[1].mesh)
			// 	let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			// 	scene.add(mesh)
			// 	scene.add(model.items[0].mesh)
			// } else {


			// let modelVoxel = this.voxelizeModel(model.items[1].mesh)
			// modelVoxel = this.fillVoxelModel(model.items[1].mesh, modelVoxel);
			// let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			// scene.add(mesh)

			// model.items.map((item: any) => {
			// 	let modelVoxel = this.voxelizeModel(item.mesh)
			// 	let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			// 	scene.add(mesh)
			// })

			scene.add(model)
			// scene.add(model.items[1].mesh)
			// }

			// Tạo trục oxyz
			const axesHelper = new THREE.AxesHelper(5);
			scene.add(axesHelper);
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
	};


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

	private voxelizeModel(importedScene: any) {
		const importedMeshes: any = [];
		importedScene.traverse((child: any) => {
			if (child instanceof THREE.Mesh) {
				child.material.side = THREE.DoubleSide;
				importedMeshes.push(child);
			}
		});

		let modelVoxels: any = [];

		for (const mesh of importedMeshes) {
			const boundingBox = new THREE.Box3().setFromObject(mesh);

			// Get size data
			const gridSize = this.params.gridSize;
			const boxSize = this.params.boxSize;
			for (let x = boundingBox.min.x - gridSize; x <= boundingBox.max.x + gridSize; x += gridSize) {
				for (let y = boundingBox.min.y - gridSize; y <= boundingBox.max.y + gridSize; y += gridSize) {
					for (let z = boundingBox.min.z - gridSize; z <= boundingBox.max.z + gridSize; z += gridSize) {
						// get position form center of voxel block
						const centerPoint = new THREE.Vector3(x + boxSize / 2, y + boxSize / 2, z + boxSize / 2);

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
		dotGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([point.x, point.y, point.z]), 3));
		const dotMaterial = new THREE.PointsMaterial({ size: 0.05, color: 0xff0000 });
		const dot = new THREE.Points(dotGeometry, dotMaterial);

		const scene = this._components.scene.get();
		scene.add(dot)
	}

	private isInsideMesh2(pos: any, mesh: any) {
		const data = [
			new THREE.Vector3(0, -1, 0),
			new THREE.Vector3(1, 0, 0),
			new THREE.Vector3(0, 1, 0),
			new THREE.Vector3(0, 0, 1),
			new THREE.Vector3(-1, 0, 0),
			new THREE.Vector3(0, 0, -1)
		]

		let count = 0;
		for (let ray of data) {
			const rayCaster = new THREE.Raycaster();
			rayCaster.set(pos, ray);
			let rayCasterIntersects = rayCaster.intersectObject(mesh, false);
			if (rayCasterIntersects.length > 0) {
				count++
			}
		}
		// console.log('--------------- count', count)
		return count > 4;
	}

	private fillVoxelModel(importedScene: any, modelVoxels: any[]) {
		const points = modelVoxels.map((p: any) => p.position);
		const importedMeshes: any = [];
		importedScene.traverse((child: any) => {
			if (child instanceof THREE.Mesh) {
				child.material.side = THREE.DoubleSide;
				importedMeshes.push(child);
			}
		});

		for (const mesh of importedMeshes) {
			const boundingBox = new THREE.Box3().setFromObject(mesh);

			// Get size data
			const gridSize = this.params.gridSize;
			const boxSize = this.params.boxSize;

			for (let y = boundingBox.min.y - gridSize; y <= boundingBox.max.y + gridSize; y += gridSize) {
				for (let z = boundingBox.min.z - gridSize; z <= boundingBox.max.z + gridSize; z += gridSize) {
					const x = boundingBox.max.x + gridSize;
					// get position form center of voxel block
					const centerPoint = new THREE.Vector3(x + boxSize / 2, y + boxSize / 2, z + boxSize / 2);
					const pointListYZ = points.filter((p: THREE.Vector3) => p.y === centerPoint.y && p.z === centerPoint.z);

					for (let i = 0; i < pointListYZ.length; i++) {
						const indexNextPoint = i + 1;
						if (indexNextPoint >= pointListYZ.length) {
							break
						}

						const currentPoint = pointListYZ[i];
						const nextPoint = pointListYZ[indexNextPoint];

						const distance = Math.abs(currentPoint.x - nextPoint.x);
						if (distance > gridSize) {
							const addQuantity = distance / gridSize;
							for (let i = 0; i < addQuantity; i++) {
								const newCenterPoint = new THREE.Vector3(currentPoint.x + gridSize * (i + 1), currentPoint.y, currentPoint.z);
								// modelVoxels.push({position: newCenterPoint})

								if (this.isInsideMesh2(newCenterPoint, mesh)) {
									this.testRenderCenterVoxel(newCenterPoint);
									modelVoxels.push({ position: newCenterPoint })
								}
							}
							// skipPoint = nextPoint.clone();
						}
					}

					// if (pointListXY.length === 2) {
					// 	const first = pointListXY[0];
					// 	const last = pointListXY[pointListXY.length - 1];
					//
					// 	const distance = Math.abs(first.z - last.z);
					// 	if (distance > gridSize/2) {
					//
					// 		this.testRenderCenterVoxel(first)
					// 		this.testRenderCenterVoxel(last)
					// 		const addQuantity = distance * 2 / gridSize;
					// 		for (let i = 0; i < addQuantity; i++) {
					// 			const newCenterPoint = new THREE.Vector3(centerPoint.x, centerPoint.y, first.z + gridSize);
					// 			modelVoxels.push({position: newCenterPoint})
					// 		}
					// 	}
					// }
				}
			}

			// for (let x = boundingBox.min.x - gridSize; x <= boundingBox.max.x + gridSize; x += gridSize) {
			// 	for (let y = boundingBox.min.y - gridSize; y <= boundingBox.max.y + gridSize; y += gridSize) {
			// 		const z = boundingBox.max.z + gridSize;
			// 		// get position form center of voxel block
			// 		const centerPoint = new THREE.Vector3(x + boxSize / 2, y + boxSize / 2, z + boxSize / 2);
			// 		const pointListXY = points.filter((p: THREE.Vector3) => p.x === centerPoint.x && p.y === centerPoint.y);
			//
			// 		for (let i = 0; i < pointListXY.length; i++) {
			// 			if (i === pointListXY.length - 1) {
			// 				break;
			// 			}
			//
			// 			const currentPoint = pointListXY[i];
			// 			const nextPoint = pointListXY[i+1];
			// 			const distance = Math.abs(currentPoint.z - nextPoint.z);
			// 			if (distance > gridSize) {
			// 				const addQuantity = distance / gridSize;
			// 				for (let i = 0; i < addQuantity; i++) {
			// 					const newCenterPoint = new THREE.Vector3(centerPoint.x, centerPoint.y, currentPoint.z + gridSize * (i + 1));
			// 					modelVoxels.push({position: newCenterPoint})
			// 				}
			// 			}
			// 		}
			//
			// 		// if (pointListXY.length === 2) {
			// 		// 	const first = pointListXY[0];
			// 		// 	const last = pointListXY[pointListXY.length - 1];
			// 		//
			// 		// 	const distance = Math.abs(first.z - last.z);
			// 		// 	if (distance > gridSize/2) {
			// 		//
			// 		// 		this.testRenderCenterVoxel(first)
			// 		// 		this.testRenderCenterVoxel(last)
			// 		// 		const addQuantity = distance * 2 / gridSize;
			// 		// 		for (let i = 0; i < addQuantity; i++) {
			// 		// 			const newCenterPoint = new THREE.Vector3(centerPoint.x, centerPoint.y, first.z + gridSize);
			// 		// 			modelVoxels.push({position: newCenterPoint})
			// 		// 		}
			// 		// 	}
			// 		// }
			// 	}
			// }
		}
		return modelVoxels;
	}

	private isInsideMesh(pos: any, ray: any, mesh: any) {
		const rayCaster = new THREE.Raycaster();
		rayCaster.set(pos, ray);
		let rayCasterIntersects = rayCaster.intersectObject(mesh, false);
		// we need odd number of intersections
		return rayCasterIntersects.length > 0 && rayCasterIntersects[0].distance <= this.params.gridSize;
	}

	private recreateInstancedMesh(array: any, cnt: any) {
		console.log("cnt", cnt)
		// remove the old mesh and voxels data
		let instancedMesh,
			voxelGeometry = new RoundedBoxGeometry(this.params.boxSize, this.params.boxSize, this.params.boxSize, 2, this.params.boxRoundness),
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

	private voxelButton(model: any) {
		let buttonActive = true
		const scene = this._components.scene.get();

		const mainToolbar = new OBC.Toolbar(this._components, {
			name: 'top',
			position: "top",
		})
		this._components.ui.addToolbar(mainToolbar)
		const voxelButton = new OBC.Button(this._components)
		voxelButton.materialIcon = "apps"
		voxelButton.onClick.add(() => {
			if (buttonActive) {
				scene.remove(model)
				let modelVoxel = this.voxelizeModel(model)
				modelVoxel = this.fillVoxelModel(model, modelVoxel);
				let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
				this.currentMesh = mesh
				this.createNewGui(scene, mesh, model, modelVoxel)
				scene.add(mesh)
			} else {
				scene.add(model)
				scene.remove(this.currentMesh)
			}
			voxelButton.active = buttonActive
			buttonActive = !buttonActive
		})
		mainToolbar.addChild(voxelButton)
	}

	private createNewGui(scene: any, mesh: any, model: any, modelVoxel: any) {
		let currentBoxSize = this.params.boxSize
		const gui = new GUI()
		gui.add(this.params, "gridSize", this.minGridSize, 2).step(.1).onChange(() => {
			scene.remove(mesh)
			modelVoxel = this.voxelizeModel(model)
			modelVoxel = this.fillVoxelModel(model, modelVoxel);
			mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			this.currentMesh = mesh
			scene.add(mesh)

			this.createNewGui(scene, mesh, model, modelVoxel)
		}).name("grid size");
		gui.add(this.params, "boxSize", .1, this.params.gridSize).step(.1).setValue(currentBoxSize && currentBoxSize <= this.params.gridSize ? currentBoxSize : this.params.gridSize).onChange((value) => {
			currentBoxSize = value
			scene.remove(mesh)
			modelVoxel = this.voxelizeModel(model)
			modelVoxel = this.fillVoxelModel(model, modelVoxel);
			mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			this.currentMesh = mesh
			scene.add(mesh)
		})
	}
}