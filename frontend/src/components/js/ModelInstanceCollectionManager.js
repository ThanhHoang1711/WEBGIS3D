/* eslint-disable */
import * as Cesium from "cesium";

export class ModelInstanceCollectionManager {
    constructor(viewer, modelManager) {
        this.viewer = viewer;
        this.modelManager = modelManager;
        
        this.isInstancing = false;
        this.selectedModel = null;
        this.instanceHandler = null;
        this.currentCollection = null;
        this.instances = new Map(); // Map: collectionId -> { collection, instancesData }
        this.nextInstanceId = 1;
        
        this.tempEntities = [];
        this.escapeHandler = null;
        
        this.initUI();
    }

    /* =========================
       Khởi tạo UI
       ========================= */
    initUI() {
        this.injectInstanceButton();
    }

    /* =========================
       Tiêm nút Instance vào ModelManager
       ========================= */
    injectInstanceButton() {
        setTimeout(() => {
            const toolbar = document.querySelector('.panel-toolbar');
            if (toolbar && !document.getElementById('btnInstanceCollection')) {
                const instanceBtn = document.createElement('button');
                instanceBtn.id = 'btnInstanceCollection';
                instanceBtn.className = 'btn-instance-collection';
                instanceBtn.innerHTML = '⚡ Instance (GPU)';
                instanceBtn.title = 'Trải thảm model với GPU Instancing - Hiệu năng cao';
                
                instanceBtn.addEventListener('click', () => {
                    this.toggleInstancing();
                });

                // Chèn vào toolbar
                const convertBtn = document.getElementById('btnConvert3DTiles');
                if (convertBtn) {
                    toolbar.insertBefore(instanceBtn, convertBtn.nextSibling);
                } else {
                    toolbar.appendChild(instanceBtn);
                }
            }
        }, 1000);
    }

    /* =========================
       Bật/tắt chế độ instance
       ========================= */
    toggleInstancing() {
        if (this.isInstancing) {
            this.stopInstancing();
        } else {
            this.startInstancing();
        }
    }

    /* =========================
       Bắt đầu chế độ instance
       ========================= */
    async startInstancing() {
        const selectedModels = this.getSelectedModels();
        
        if (selectedModels.length === 0) {
            alert('❌ Vui lòng chọn ít nhất 1 model từ bảng!');
            return;
        }

        if (selectedModels.length > 1) {
            alert('⚠️ Đang chọn nhiều model, chỉ model đầu tiên sẽ được sử dụng!');
        }

        this.selectedModel = selectedModels[0];
        
        try {
            // Tạo collection mới cho model này
            await this.createInstanceCollection(this.selectedModel);
            
            this.isInstancing = true;
            this.updateInstanceButton(true);
            this.showInstanceStatus(`⚡ Đang instance (GPU): ${this.selectedModel.name} - Click trên map để đặt, ESC để dừng`);
            
            this.startInstanceHandler();
            this.addEscapeListener();
            
        } catch (error) {
            console.error('❌ Error creating instance collection:', error);
            alert('❌ Không thể tạo instance collection: ' + error.message);
        }
    }

    /* =========================
       Tạo ModelInstanceCollection
       ========================= */
    async createInstanceCollection(modelData) {
        const collectionId = `collection_${modelData.id}_${Date.now()}`;
        
        // Tạo collection với instances rỗng ban đầu
        const collection = new Cesium.ModelInstanceCollection({
            url: modelData.url,
            instances: [] // Bắt đầu với mảng rỗng
        });

        // Đợi model load xong
        await collection.readyPromise;
        
        // Áp dụng scale cho toàn bộ collection
        if (modelData.scale && modelData.scale !== 1) {
            collection.modelMatrix = Cesium.Matrix4.fromScale(
                new Cesium.Cartesian3(modelData.scale, modelData.scale, modelData.scale)
            );
        }

        // Thêm collection vào scene
        this.viewer.scene.primitives.add(collection);
        
        // Lưu collection
        this.currentCollection = {
            id: collectionId,
            collection: collection,
            modelData: modelData,
            instances: [] // Lưu thông tin từng instance
        };
        
        this.instances.set(collectionId, this.currentCollection);
        
        console.log(`✅ Created instance collection: ${collectionId}`);
        return collection;
    }

    /* =========================
       Dừng chế độ instance
       ========================= */
    stopInstancing() {
        this.isInstancing = false;
        this.selectedModel = null;
        
        if (this.instanceHandler) {
            this.instanceHandler.destroy();
            this.instanceHandler = null;
        }

        this.clearTempEntities();
        this.updateInstanceButton(false);
        this.showInstanceStatus('✅ Đã dừng instance');
        this.removeEscapeListener();
    }

    /* =========================
       Lấy các model được chọn
       ========================= */
    getSelectedModels() {
        const selectedModels = [];
        const checkboxes = document.querySelectorAll('.model-checkbox:checked');
        
        checkboxes.forEach(checkbox => {
            const modelId = parseInt(checkbox.dataset.modelId);
            const model = this.modelManager.allModels.find(m => m.id === modelId);
            if (model) {
                selectedModels.push(model);
            }
        });
        
        return selectedModels;
    }

    /* =========================
       Bắt đầu handler cho instance
       ========================= */
    startInstanceHandler() {
        this.instanceHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        
        this.instanceHandler.setInputAction((click) => {
            if (!this.isInstancing || !this.currentCollection) return;
            
            this.placeInstance(click.position);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Preview khi di chuột
        this.instanceHandler.setInputAction((movement) => {
            if (!this.isInstancing || !this.currentCollection) return;
            
            this.showInstancePreview(movement.endPosition);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    /* =========================
       Đặt instance tại vị trí click
       ========================= */
    placeInstance(clickPosition) {
        try {
            const cartesian = this.viewer.scene.pickPosition(clickPosition);
            if (!cartesian) return;

            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const height = cartographic.height;

            // Thêm instance vào collection
            this.addInstanceToCollection(lon, lat, height);
            
            console.log(`📍 Instance placed at: ${lon.toFixed(6)}, ${lat.toFixed(6)}`);
            
        } catch (error) {
            console.error('❌ Error placing instance:', error);
        }
    }

    /* =========================
       Thêm instance vào collection
       ========================= */
    addInstanceToCollection(lon, lat, height) {
        if (!this.currentCollection) return;

        const position = Cesium.Cartesian3.fromDegrees(lon, lat, height);
        const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);
        
        // Tạo instance mới
        const instanceId = this.nextInstanceId++;
        const instance = {
            modelMatrix: modelMatrix
        };

        // Thêm vào collection
        this.currentCollection.collection.instances.push(instance);
        
        // Lưu thông tin instance
        const instanceData = {
            id: instanceId,
            position: { lon, lat, height },
            modelMatrix: modelMatrix,
            collectionId: this.currentCollection.id
        };
        
        this.currentCollection.instances.push(instanceData);
        
        // Tạo entity để quản lý (optional)
        const entity = this.createInstanceEntity(instanceId, position);
        instanceData.entity = entity;

        console.log(`✅ Instance ${instanceId} added to collection`);
    }

    /* =========================
       Tạo entity để quản lý instance (optional)
       ========================= */
    createInstanceEntity(instanceId, position) {
        return this.viewer.entities.add({
            id: `instance_${this.currentCollection.id}_${instanceId}`,
            position: position,
            point: {
                pixelSize: 4,
                color: Cesium.Color.CYAN.withAlpha(0.6),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            label: {
                text: `#${instanceId}`,
                font: '10px monospace',
                pixelOffset: new Cesium.Cartesian2(0, -15),
                fillColor: Cesium.Color.WHITE,
                showBackground: true,
                backgroundColor: Cesium.Color.BLACK.withAlpha(0.5),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
    }

    /* =========================
       Hiển thị preview khi di chuột
       ========================= */
    showInstancePreview(mousePosition) {
        this.clearTempEntities();
        
        const cartesian = this.viewer.scene.pickPosition(mousePosition);
        if (!cartesian) return;

        // Tạo preview point
        const previewPoint = this.viewer.entities.add({
            position: cartesian,
            point: {
                pixelSize: 10,
                color: Cesium.Color.YELLOW.withAlpha(0.8),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
        
        this.tempEntities.push(previewPoint);

        // Tạo preview model (tạm thời)
        if (this.currentCollection && this.currentCollection.modelData) {
            const previewModel = this.viewer.entities.add({
                position: cartesian,
                orientation: Cesium.Transforms.headingPitchRollQuaternion(
                    cartesian, 
                    new Cesium.HeadingPitchRoll(0, 0, 0)
                ),
                model: {
                    uri: this.currentCollection.modelData.url,
                    scale: (this.currentCollection.modelData.scale || 1) * 0.8, // Scale nhỏ hơn để preview
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                }
            });
            
            this.tempEntities.push(previewModel);
        }
    }

    /* =========================
       Xoá các entity tạm thời
       ========================= */
    clearTempEntities() {
        this.tempEntities.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.tempEntities = [];
    }

    /* =========================
       Thêm listener cho phím ESC
       ========================= */
    addEscapeListener() {
        this.escapeHandler = (event) => {
            if (event.key === 'Escape' && this.isInstancing) {
                this.stopInstancing();
            }
        };
        
        document.addEventListener('keydown', this.escapeHandler);
    }

    /* =========================
       Xoá escape listener
       ========================= */
    removeEscapeListener() {
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
    }

    /* =========================
       Cập nhật trạng thái nút
       ========================= */
    updateInstanceButton(isActive) {
        const btn = document.getElementById('btnInstanceCollection');
        if (btn) {
            if (isActive) {
                btn.classList.add('active');
                btn.innerHTML = '⏹️ Dừng Instance';
                btn.title = 'Đang instance (GPU) - Click để dừng hoặc nhấn ESC';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = '⚡ Instance (GPU)';
                btn.title = 'Trải thảm model với GPU Instancing - Hiệu năng cao';
            }
        }
    }

    /* =========================
       Hiển thị trạng thái
       ========================= */
    showInstanceStatus(message) {
        if (this.modelManager.showManagerStatus) {
            this.modelManager.showManagerStatus(message);
        } else {
            console.log('Instance Status:', message);
        }
    }

    /* =========================
       Lấy thông tin collection hiện tại
       ========================= */
    getCurrentCollectionInfo() {
        if (!this.currentCollection) return null;
        
        return {
            id: this.currentCollection.id,
            modelName: this.currentCollection.modelData.name,
            instanceCount: this.currentCollection.instances.length,
            instances: this.currentCollection.instances
        };
    }

    /* =========================
       Lấy tất cả collections
       ========================= */
    getAllCollections() {
        const collections = [];
        this.instances.forEach((collectionData, collectionId) => {
            collections.push({
                id: collectionId,
                modelName: collectionData.modelData.name,
                instanceCount: collectionData.instances.length,
                collection: collectionData.collection
            });
        });
        return collections;
    }

    /* =========================
       Xoá collection cụ thể
       ========================= */
    removeCollection(collectionId) {
        const collectionData = this.instances.get(collectionId);
        if (collectionData) {
            // Xoá collection khỏi scene
            this.viewer.scene.primitives.remove(collectionData.collection);
            
            // Xoá các entity quản lý
            collectionData.instances.forEach(instance => {
                if (instance.entity) {
                    this.viewer.entities.remove(instance.entity);
                }
            });
            
            // Xoá khỏi map
            this.instances.delete(collectionId);
            
            console.log(`✅ Collection removed: ${collectionId}`);
            
            // Nếu đang active, reset current collection
            if (this.currentCollection && this.currentCollection.id === collectionId) {
                this.currentCollection = null;
                if (this.isInstancing) {
                    this.stopInstancing();
                }
            }
        }
    }

    /* =========================
       Xoá tất cả collections
       ========================= */
    clearAllCollections() {
        this.instances.forEach((collectionData, collectionId) => {
            this.viewer.scene.primitives.remove(collectionData.collection);
            collectionData.instances.forEach(instance => {
                if (instance.entity) {
                    this.viewer.entities.remove(instance.entity);
                }
            });
        });
        
        this.instances.clear();
        this.currentCollection = null;
        this.stopInstancing();
        
        console.log('✅ All collections cleared');
    }

    /* =========================
       Xoá instance cụ thể khỏi collection
       ========================= */
    removeInstanceFromCollection(collectionId, instanceId) {
        const collectionData = this.instances.get(collectionId);
        if (!collectionData) return;

        const instanceIndex = collectionData.instances.findIndex(inst => inst.id === instanceId);
        if (instanceIndex === -1) return;

        const instance = collectionData.instances[instanceIndex];
        
        // Xoá instance khỏi collection
        const collectionInstanceIndex = collectionData.collection.instances.findIndex(
            inst => inst.modelMatrix === instance.modelMatrix
        );
        
        if (collectionInstanceIndex !== -1) {
            collectionData.collection.instances.splice(collectionInstanceIndex, 1);
        }
        
        // Xoá entity quản lý
        if (instance.entity) {
            this.viewer.entities.remove(instance.entity);
        }
        
        // Xoá khỏi danh sách
        collectionData.instances.splice(instanceIndex, 1);
        
        console.log(`✅ Instance ${instanceId} removed from collection ${collectionId}`);
    }

    /* =========================
       Export instances data (để lưu hoặc chia sẻ)
       ========================= */
    exportInstancesData() {
        const exportData = {
            collections: []
        };

        this.instances.forEach((collectionData, collectionId) => {
            exportData.collections.push({
                collectionId: collectionId,
                modelUrl: collectionData.modelData.url,
                modelName: collectionData.modelData.name,
                scale: collectionData.modelData.scale,
                instances: collectionData.instances.map(instance => ({
                    id: instance.id,
                    lon: instance.position.lon,
                    lat: instance.position.lat,
                    height: instance.position.height
                }))
            });
        });

        return exportData;
    }

    /* =========================
       Hủy và dọn dẹp
       ========================= */
    destroy() {
        this.stopInstancing();
        this.clearAllCollections();
        this.clearTempEntities();
        
        // Xoá nút khỏi UI
        const btn = document.getElementById('btnInstanceCollection');
        if (btn && btn.parentNode) {
            btn.parentNode.removeChild(btn);
        }
    }
}

export default ModelInstanceCollectionManager;