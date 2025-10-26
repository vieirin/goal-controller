import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {RuntimeOp} from "edgemodel/RuntimeOp";
import {Operand} from "edgemodel/Operand";
import {ExecutionDetails} from "edgemodel/ExecutionDetails";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {AbstractCollection} from "ecore/AbstractCollection";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class ExecutionDetailsBase
			extends BasicEObjectImpl
			implements ExecutionDetails
			{
				private _operator:RuntimeOp = RuntimeOp.ANY;
				get operator():RuntimeOp{
					return this._operator;
				}
				set operator(value:RuntimeOp){
					this._operator = value; 
				}
				private _operand:OrderedSet<Operand> = null;
				
				get operand():OrderedSet<Operand>{
					if(this._operand===null){
						this._operand = new OrderedSet<Operand>(this, EdgemodelPackageLiterals.EXECUTION_DETAILS__OPERAND, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.EXECUTION_DETAILS__OPERAND);
							
					}
					return this._operand;
					
				}
				
				

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return ExecutionDetailsBase.eStaticClass;
				}
			
			
			
				public eGet_number_boolean_boolean(featureID:number, resolve:boolean, coreType:boolean):any{
					switch (featureID) {
						case EdgemodelPackageLiterals.EXECUTION_DETAILS__OPERATOR:
							return this.operator;
						case EdgemodelPackageLiterals.EXECUTION_DETAILS__OPERAND:
							return this.operand;
					}
					//return this.eGetFromBasicEObjectImpl(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.EXECUTION_DETAILS__OPERATOR:
							this.operator = <RuntimeOp> newValue;
							return;
						case EdgemodelPackageLiterals.EXECUTION_DETAILS__OPERAND:
							this.operand.clear();
							this.operand.addAll(newValue);
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
