import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {Condition} from "edgemodel/Condition";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class ConditionBase
			extends BasicEObjectImpl
			implements Condition
			{
				private _expression:string = '';
				get expression():string{
					return this._expression;
				}
				set expression(value:string){
					this._expression = value; 
				}

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return ConditionBase.eStaticClass;
				}
			
			
			
				public eGet_number_boolean_boolean(featureID:number, resolve:boolean, coreType:boolean):any{
					switch (featureID) {
						case EdgemodelPackageLiterals.CONDITION__EXPRESSION:
							return this.expression;
					}
					//return this.eGetFromBasicEObjectImpl(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.CONDITION__EXPRESSION:
							this.expression = <string> newValue;
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
