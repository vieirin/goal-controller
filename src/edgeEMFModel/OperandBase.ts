import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {Operand} from "edgemodel/Operand";
import {Node} from "edgemodel/Node";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {Set} from "ecore/Set";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {AbstractCollection} from "ecore/AbstractCollection";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class OperandBase
			extends BasicEObjectImpl
			implements Operand
			{
				private _retryLimit:number = 0;
				get retryLimit():number{
					return this._retryLimit;
				}
				set retryLimit(value:number){
					this._retryLimit = value; 
				}
				private _target:OrderedSet<Node> = null;
				
				get target():OrderedSet<Node>{
					if(this._target===null){
						this._target = new OrderedSet<Node>(this, EdgemodelPackageLiterals.OPERAND__TARGET, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.OPERAND__TARGET);
							
					}
					return this._target;
					
				}
				
				

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return OperandBase.eStaticClass;
				}
			
			
			
				public eGet_number_boolean_boolean(featureID:number, resolve:boolean, coreType:boolean):any{
					switch (featureID) {
						case EdgemodelPackageLiterals.OPERAND__RETRY_LIMIT:
							return this.retryLimit;
						case EdgemodelPackageLiterals.OPERAND__TARGET:
							return this.target;
					}
					//return this.eGetFromBasicEObjectImpl(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.OPERAND__RETRY_LIMIT:
							this.retryLimit = <number> newValue;
							return;
						case EdgemodelPackageLiterals.OPERAND__TARGET:
							this.target.clear();
							this.target.addAll(newValue);
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
