import * as THREE from "three";
import * as OBC from 'openbim-components';
import {FragmentMesh, FragmentsGroup} from 'bim-fragment';
import { cullerUpdater } from './culler-updater';
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MeshBVH } from 'three-mesh-bvh';

const params = {
	gridSize: 0.3,
	boxSize: 0.3,
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
			for (let i = 0; i < model.items.length; i++) {
				if (model.items[i].capacity === 1) {
					// let modelVoxel = this.voxelizeModel(model.children[i] as FragmentMesh)
					let modelVoxel = this.newVoxelizeModel(model.items[i].mesh as FragmentMesh)
					// modelVoxel = this.fillVoxelModel(model.children[i], modelVoxel);
					let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
					scene.add(mesh)
				}

			}
			const timestampEnd = new Date().getTime();
			console.log(`Success took ${timestampEnd - timestampStart} ms`)


			// model.items.map((item: any) => {
			// 	let modelVoxel = this.voxelizeModel(item.mesh)
			// 	let mesh = this.recreateInstancedMesh(modelVoxel, modelVoxel.length)
			// 	scene.add(mesh)
			// })

			// scene.add(model)
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

	private newVoxelizeModel(importedScene: any) {
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

		// Get size data
		const gridSize = params.gridSize;
		const boxSize = params.boxSize;
		for (let x = boundingBox.min.x - gridSize; x <= boundingBox.max.x + gridSize; x += gridSize) {
			for (let y = boundingBox.min.y - gridSize; y <= boundingBox.max.y + gridSize; y += gridSize) {
				for (let z = boundingBox.min.z - gridSize; z <= boundingBox.max.z + gridSize; z += gridSize) {
					// get position form center of voxel block
					const centerPoint = new THREE.Vector3(x + boxSize, y + boxSize, z + boxSize);
					const voxelBox = new THREE.Box3(centerPoint, centerPoint.clone().add(new THREE.Vector3(boxSize, boxSize, boxSize)));

					if (bvh.shapecast({
						intersectsBounds: (box) => {
							return voxelBox.intersectsBox(box);
						},
						intersectsTriangle: (tri) => {
							return tri.intersectsBox(voxelBox);
						}
					})) {
						modelVoxels.push({position: centerPoint}); // Thêm voxel vào mảng
					}
					// else {
					// 	const directions = [
					// 		new THREE.Vector3(1, 0, 0),
					// 		new THREE.Vector3(-1, 0, 0),
					// 		new THREE.Vector3(0, 1, 0),
					// 		new THREE.Vector3(0, -1, 0),
					// 		new THREE.Vector3(0, 0, 1),
					// 		new THREE.Vector3(0, 0, -1)
					// 	];
					//
					// 	for (const direction of directions) {
					// 		const ray = new THREE.Ray(centerPoint, direction);
					// 		const intersects = bvh.raycast(ray, mesh.material);
					//
					// 		if (intersects.length > 4) {
					// 			modelVoxels.push({position: centerPoint});
					// 			break;
					// 		}
					// 	}
					// }
				}
			}
		}

		return modelVoxels
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

						this.testRenderCenterVoxel(centerPoint);
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

	private isInsideMesh2(pos: THREE.Vector3, mesh: any) {
		const directions = [
			new THREE.Vector3(1, 0, 0), // Hướng x dương
			new THREE.Vector3(-1, 0, 0), // Hướng x âm
			new THREE.Vector3(0, 1, 0), // Hướng y dương
			new THREE.Vector3(0, -1, 0), // Hướng y âm
			new THREE.Vector3(0, 0, 1), // Hướng z dương
			new THREE.Vector3(0, 0, -1) // Hướng z âm
		];

		const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
		const lines = [];
		const scene = this._components.scene.get();

		// directions.forEach(direction => {
		// 	const end = pos.clone().add(direction.multiplyScalar(2)); // Điểm kết thúc của tia
		// 	const points = [pos, end];
		// 	const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
		// 	const line = new THREE.Line(lineGeometry, material);
		// 	lines.push(line);
		// 	scene.add(line);
		//
		// 	const raycaster = new THREE.Raycaster(pos, direction);
		// 	const intersections = raycaster.intersectObject(mesh);
		//
		// 	if (intersections.length > 0) {
		// 		console.log(`Tia đã va chạm với mặt của hình lập phương.`);
		// 	} else {
		// 		console.log(`Tia không va chạm với mặt của hình lập phương.`);
		// 	}
		// });

		let count = 0;
		for (let ray of directions) {
			const rayCaster = new THREE.Raycaster();
			rayCaster.set(pos, ray);
			let rayCasterIntersects = rayCaster.intersectObject(mesh, false);
			if (rayCasterIntersects.length > 0) {
				count++
			}
		}
		console.log('--------------- count', count)
		return count >= 4;
	}

	private isPointInTriangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, p: THREE.Vector3) {
		const v0 = c.clone().sub(a);
		const v1 = b.clone().sub(a);
		const v2 = p.clone().sub(a);

		const dot00 = v0.dot(v0);
		const dot01 = v0.dot(v1);
		const dot02 = v0.dot(v2);
		const dot11 = v1.dot(v1);
		const dot12 = v1.dot(v2);

		const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
		const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
		const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

		return (u >= 0) && (v >= 0) && (u + v < 1);
	}

	private checkInSideMesh(vertices: any[], point: THREE.Vector3) {
		for (let i = 0; i < vertices.length; i += 3) {
			const x = vertices[i];
			const y = vertices[i + 1];
			const z = vertices[i + 2];

			// Kiểm tra xem điểm có nằm trong tam giác tạo bởi 3 điểm vertex liên tiếp hay không
			if (
				this.isPointInTriangle(
					new THREE.Vector3(x, y, z),
					new THREE.Vector3(vertices[i + 3], vertices[i + 4], vertices[i + 5]),
					new THREE.Vector3(vertices[i + 6], vertices[i + 7], vertices[i + 8]),
					point
				)
			) {
				return true;
			}
		}

		return false;
	}

	private isPointInsideModel(point: THREE.Vector3, mesh: any) {
		const directions = [
			new THREE.Vector3(1, 0, 0), // Hướng x dương
			new THREE.Vector3(-1, 0, 0), // Hướng x âm
			new THREE.Vector3(0, 1, 0), // Hướng y dương
			new THREE.Vector3(0, -1, 0), // Hướng y âm
			new THREE.Vector3(0, 0, 1), // Hướng z dương
			new THREE.Vector3(0, 0, -1) // Hướng z âm
		];

		let count = 0;
		for (let direction of directions) {
			this._raycaster.set(point, direction);
			let rayCasterIntersects = this._raycaster.intersectObject(mesh, false);
			if (rayCasterIntersects.length > 0) {
				count++;
			}
		}

		return count === 6;
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
			let childVertices: any[] = mesh.geometry.attributes.position.array;
			// scene.add(mesh)
			const boundingBox = new THREE.Box3().setFromObject(mesh);

			// Get size data
			const gridSize = params.gridSize;
			const boxSize = params.boxSize;

			for (let x = boundingBox.min.x - gridSize; x <= boundingBox.max.x + gridSize; x += gridSize) {
				for (let y = boundingBox.min.y - gridSize; y <= boundingBox.max.y + gridSize; y += gridSize) {
					const z = boundingBox.max.z + gridSize;
					// get position form center of voxel block
					const centerPoint = new THREE.Vector3(x + boxSize, y + boxSize, z + boxSize);
					const pointListXY = points.filter((p: THREE.Vector3) => p.x === centerPoint.x && p.y === centerPoint.y);

					for (let i = 0; i < pointListXY.length; i++) {
						const indexNextPoint = i+1;
						if (indexNextPoint >= pointListXY.length) {
							break
						}

						const currentPoint = pointListXY[i];
						const nextPoint = pointListXY[indexNextPoint];

						const distance = Math.abs(currentPoint.z - nextPoint.z);
						if (distance > gridSize) {
							const addQuantity = distance / gridSize;
							for (let i = 0; i < addQuantity; i++) {
								const newCenterPoint = new THREE.Vector3(currentPoint.x, currentPoint.y, currentPoint.z  + gridSize * (i + 1));
								this.testRenderCenterVoxel(newCenterPoint);
								modelVoxels.push({position: newCenterPoint})
								if (this.isPointInsideModel(newCenterPoint, mesh)) {
									// const existModel = modelVoxels.find(p => p.position.x === newCenterPoint.x
									// 	&&  p.position.y === newCenterPoint.y
									// 	&&  p.position.z === newCenterPoint.z)
									// if (existModel) {
									 	// modelVoxels.push({position: newCenterPoint})
									// }
								}
							}
						}
					}
				}
			}
		}
		return modelVoxels;
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