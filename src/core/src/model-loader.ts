import * as THREE from "three";
import * as OBC from 'openbim-components';
import { FragmentsGroup } from 'bim-fragment';
import { cullerUpdater } from './culler-updater';
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const params = {
	gridSize: 0.15,
	boxSize: 0.1,
	boxRoundness: 0.01
}

export class ModelLoader {
	public _dragDrop: OBC.DragAndDropInput;
	private _components: OBC.Components;
	private _loadingModal: OBC.Modal;
	private _blurScreen: OBC.SimpleUIComponent;

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

			// Save the IFC for later export
			// await cacher.delete([model.uuid]);
			// await cacher.save(model.uuid, fileURL);

			await this.setupLoadedModel(model);

			// if (!isCached) {
			// 	await cacher.saveFragmentGroup(model, fileID);
			// }
			// if (model.items.length > 1) {
			// 	let modelVoxel = this.voxelizeModel(model.items[1].mesh)
			// 	let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			// 	scene.add(mesh)
			// 	scene.add(model.items[0].mesh)
			// } else {
			let modelVoxel = this.voxelizeModel(model.items[1].mesh)
			let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			scene.add(mesh)
			// scene.add(model)
			// scene.add(model.items[1].mesh)
			// }

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

		let boundingBox: any = new THREE.Box3().setFromObject(importedScene);

		let modelVoxels: any = [],
			inItemX: any = [],
			inItemY: any = [],
			inItemZ: any = [],
			inPointX: any = [],
			inPointY: any = [],
			inPointZ: any = []

		for (let i = boundingBox.min.x; i <= boundingBox.max.x + params.gridSize; i += params.gridSize) {
			for (let j = boundingBox.min.y; j <= boundingBox.max.y + params.gridSize; j += params.gridSize) {
				for (let k = boundingBox.min.z; k <= boundingBox.max.z + params.gridSize; k += params.gridSize) {
					for (let meshCnt = 0; meshCnt < importedMeshes.length; meshCnt++) {
						const mesh = importedMeshes[meshCnt];
						const pos = new THREE.Vector3(i, j, k);

						if (
							this.isInsideMesh(pos, new THREE.Vector3(0, -1, 0), mesh)
							|| this.isInsideMesh(pos, new THREE.Vector3(1, 0, 0), mesh)
							|| this.isInsideMesh(pos, new THREE.Vector3(0, 1, 0), mesh)
							|| this.isInsideMesh(pos, new THREE.Vector3(0, 0, 1), mesh)
							|| this.isInsideMesh(pos, new THREE.Vector3(-1, 0, 0), mesh)
							|| this.isInsideMesh(pos, new THREE.Vector3(0, 0, -1), mesh)
						) {
							modelVoxels.push({ position: pos });
							break;
						}
					}
				}
			}
		}
		// X
		modelVoxels.forEach((item: any) => {
			const isExistPoint = inItemX.find((inItem: any) => inItem.z === item.position.z && inItem.y === item.position.y)
			if (isExistPoint) {
				inItemX[inItemX.indexOf(isExistPoint)].listPoint.push(item)
			} else {
				inItemX.push({
					z: item.position.z,
					y: item.position.y,
					listPoint: [item]
				})
			}
		})

		inItemX.forEach((inItem: any) => {
			inItem.listPoint?.forEach((currentPoint: any, currentIndexPoint: any, listPoint: any) => {
				if (currentIndexPoint > 0 && (currentPoint.position.x - listPoint[currentIndexPoint - 1].position.x > params.gridSize)) {
					for (let i = listPoint[currentIndexPoint - 1].position.x + params.gridSize; i < currentPoint.position.x; i += params.gridSize) {
						const pos = new THREE.Vector3(i, currentPoint.position.y, currentPoint.position.z);
						inPointX.push({ position: pos })
					}
				}
			})
		})

		// Y
		modelVoxels.forEach((item: any) => {
			const isExistPoint = inItemY.find((inItem: any) => inItem.x === item.position.x && inItem.z === item.position.z)
			if (isExistPoint) {
				inItemY[inItemY.indexOf(isExistPoint)].listPoint.push(item)
			} else {
				inItemY.push({
					x: item.position.x,
					z: item.position.z,
					listPoint: [item]
				})
			}
		})

		inItemY.forEach((inItem: any) => {
			inItem.listPoint?.forEach((currentPoint: any, currentIndexPoint: any, listPoint: any) => {
				if (currentIndexPoint > 0 && (currentPoint.position.y - listPoint[currentIndexPoint - 1].position.y > params.gridSize)) {
					for (let i = listPoint[currentIndexPoint - 1].position.y + params.gridSize; i < currentPoint.position.y; i += params.gridSize) {
						const pos = new THREE.Vector3(currentPoint.position.x, i, currentPoint.position.z);
						inPointY.push({ position: pos })
					}
				}
			})
		})

		// Z
		modelVoxels.forEach((item: any) => {
			const isExistPoint = inItemZ.find((inItem: any) => inItem.x === item.position.x && inItem.y === item.position.y)
			if (isExistPoint) {
				inItemZ[inItemZ.indexOf(isExistPoint)].listPoint.push(item)
			} else {
				inItemZ.push({
					x: item.position.x,
					y: item.position.y,
					listPoint: [item]
				})
			}
		})

		inItemZ.forEach((inItem: any) => {
			inItem.listPoint?.forEach((currentPoint: any, currentIndexPoint: any, listPoint: any) => {
				if (currentIndexPoint > 0 && (currentPoint.position.z - listPoint[currentIndexPoint - 1].position.z > params.gridSize)) {
					for (let i = listPoint[currentIndexPoint - 1].position.z + params.gridSize; i < currentPoint.position.z; i += params.gridSize) {
						const pos = new THREE.Vector3(currentPoint.position.x, currentPoint.position.y, i);
						inPointZ.push({ position: pos })
					}
				}
			})
		})

		var map1 = this.arrayToMap(inPointX);
		var map2 = this.arrayToMap(inPointY);
		var map3 = this.arrayToMap(inPointZ);

		for (var key in map1) {
			if (map2[key] && map3[key]) {
				modelVoxels.push({...JSON.parse(key), color: new THREE.Color().setHSL(.9, .9, .9)})
			}
		}

		// let min = new THREE.Vector3(boundingBox.min.x, boundingBox.min.y, boundingBox.min.z)
		// let max = new THREE.Vector3(boundingBox.max.x, boundingBox.max.y, boundingBox.max.z)

		// modelVoxels.push({ position: min, color: new THREE.Color().setHSL(.6, .6, .6) });
		// modelVoxels.push({ position: max, color: new THREE.Color().setHSL(.6, .6, .6) });

		return modelVoxels
	}

	private isInsideMesh(pos: any, ray: any, mesh: any) {
		const rayCaster = new THREE.Raycaster();
		rayCaster.set(pos, ray);
		let rayCasterIntersects = rayCaster.intersectObject(mesh, false);
		// we need odd number of intersections
		return rayCasterIntersects.length % 2 === 1 && rayCasterIntersects[0].distance <= params.gridSize;
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