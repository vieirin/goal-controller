    export class GoalType
    {
    	
		public static readonly ACHIEVE_VALUE:number = 0;
		public static readonly MAINTAIN_VALUE:number = 1;
		
		public static ACHIEVE:GoalType = new GoalType(0, "Achieve", "Achieve");
		public static MAINTAIN:GoalType = new GoalType(1, "Maintain", "Maintain");

		private static VALUES_ARRAY:Array<GoalType> = [
			GoalType.ACHIEVE, 
			GoalType.MAINTAIN
		];

        public static get_string(literal:string):GoalType
        {
            for (let i = 0; i < this.VALUES_ARRAY.length; i++)
            {
                let result = this.VALUES_ARRAY[i];
                if (result.toString() === literal)
                {
                    return result;
                }
            }
            return null;
        }

        public static getByName(name:string):GoalType
        {
	        for (let i = 0; i < this.VALUES_ARRAY.length; i++)
	        {
	            let result = this.VALUES_ARRAY[i];
	            if (result.getName()==name)
	            {
	                return result;
	            }
	        }
	        return null;
        }

        public static get_number(value:number):GoalType
        {
            switch (value)
            {
			case this.ACHIEVE_VALUE: return this.ACHIEVE;
			case this.MAINTAIN_VALUE: return this.MAINTAIN;
            }
            return null;
        }

	    private value:number;
	    private name:string;
	    private literal:string;

	    private constructor(value:number, name:string, literal:string)
	    {
	        this.value = value;
	        this.name = name;
	        this.literal = literal;
	    }
	
	    public getLiteral():string
	    {
	        return this.literal;
	    }
	
	    public getName():string
	    {
	        return this.name;
	    }
	
	    public getValue():number
	    {
	        return this.value;
	    }
	    
	    public toString():string
	    {
	        return this.literal;
	    }
    }
