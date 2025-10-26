    export class LinkType
    {
    	
		public static readonly AND_VALUE:number = 0;
		public static readonly OR_VALUE:number = 1;
		
		public static AND:LinkType = new LinkType(0, "AND", "AND");
		public static OR:LinkType = new LinkType(1, "OR", "OR");

		private static VALUES_ARRAY:Array<LinkType> = [
			LinkType.AND, 
			LinkType.OR
		];

        public static get_string(literal:string):LinkType
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

        public static getByName(name:string):LinkType
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

        public static get_number(value:number):LinkType
        {
            switch (value)
            {
			case this.AND_VALUE: return this.AND;
			case this.OR_VALUE: return this.OR;
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
