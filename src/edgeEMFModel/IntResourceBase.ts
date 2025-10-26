import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {ResourceImpl} from "edgemodel/ResourceImpl";
import {IntResource} from "edgemodel/IntResource";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class IntResourceBase
			extends ResourceImpl
			implements IntResource
			{
				private _initialValue:number = 0;
				get initialValue():number{
					return this._initialValue;
				}
				set initialValue(value:number){
					this._initialValue = value; 
				}
				private _lowerBound:number = 0;
				get lowerBound():number{
					return this._lowerBound;
				}
				set lowerBound(value:number){
					this._lowerBound = value; 
				}
				private _upperBound:number = 0;
				get upperBound():number{
					return this._upperBound;
				}
				set upperBound(value:number){
					this._upperBound = value; 
				}

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return IntResourceBase.eStaticClass;
				}
			
			
			
				public eGet_number_boolean_boolean(featureID:number, resolve:boolean, coreType:boolean):any{
					switch (featureID) {
						case EdgemodelPackageLiterals.INT_RESOURCE__KIND:
							return this.kind;
						case EdgemodelPackageLiterals.INT_RESOURCE__NAME:
							return this.name;
						case EdgemodelPackageLiterals.INT_RESOURCE__ID:
							return this.id;
						case EdgemodelPackageLiterals.INT_RESOURCE__INITIAL_VALUE:
							return this.initialValue;
						case EdgemodelPackageLiterals.INT_RESOURCE__LOWER_BOUND:
							return this.lowerBound;
						case EdgemodelPackageLiterals.INT_RESOURCE__UPPER_BOUND:
							return this.upperBound;
					}
					//return this.eGetFromResource(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.INT_RESOURCE__INITIAL_VALUE:
							this.initialValue = <number> newValue;
							return;
						case EdgemodelPackageLiterals.INT_RESOURCE__LOWER_BOUND:
							this.lowerBound = <number> newValue;
							return;
						case EdgemodelPackageLiterals.INT_RESOURCE__UPPER_BOUND:
							this.upperBound = <number> newValue;
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
