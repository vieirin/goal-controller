import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {Task} from "edgemodel/Task";
import {NodeImpl} from "edgemodel/NodeImpl";
import {Resource} from "edgemodel/Resource";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {AbstractCollection} from "ecore/AbstractCollection";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class TaskBase
			extends NodeImpl
			implements Task
			{
				private _resources:OrderedSet<Resource> = null;
				
				get resources():OrderedSet<Resource>{
					if(this._resources===null){
						this._resources = new OrderedSet<Resource>(this, EdgemodelPackageLiterals.TASK__RESOURCES, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.TASK__RESOURCES);
							
					}
					return this._resources;
					
				}
				
				

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return TaskBase.eStaticClass;
				}
			
			
			
				public eGet_number_boolean_boolean(featureID:number, resolve:boolean, coreType:boolean):any{
					switch (featureID) {
						case EdgemodelPackageLiterals.TASK__ID:
							return this.id;
						case EdgemodelPackageLiterals.TASK__NAME:
							return this.name;
						case EdgemodelPackageLiterals.TASK__CHILD:
							return this.child;
						case EdgemodelPackageLiterals.TASK__DEPENDS_ON:
							return this.dependsOn;
						case EdgemodelPackageLiterals.TASK__MAX_RETRIES:
							return this.maxRetries;
						case EdgemodelPackageLiterals.TASK__RESOURCES:
							return this.resources;
					}
					//return this.eGetFromNode(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.TASK__RESOURCES:
							this.resources.clear();
							this.resources.addAll(newValue);
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
