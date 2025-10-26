    export class ResourceKind
    {
    	
		public static readonly BOOL_VALUE:number = 0;
		public static readonly INT_VALUE:number = 1;
		
		public static BOOL:ResourceKind = new ResourceKind(0, "Bool", "Bool");
		public static INT:ResourceKind = new ResourceKind(1, "Int", "Int");

		private static VALUES_ARRAY:Array<ResourceKind> = [
			ResourceKind.BOOL, 
			ResourceKind.INT
		];

        public static get_string(literal:string):ResourceKind
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

        public static getByName(name:string):ResourceKind
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

        public static get_number(value:number):ResourceKind
        {
            switch (value)
            {
			case this.BOOL_VALUE: return this.BOOL;
			case this.INT_VALUE: return this.INT;
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
