import { CharStream, CommonTokenStream, ParseTreeWalker }  from 'antlr4';
import HelloLexer from './antlr/HelloLexer';
import HelloParser from './antlr/HelloParser';
import HelloListener from './antlr/HelloListener';

const input = "hello WORD word"
const chars = new CharStream(input); // replace this with a FileStream as required
const lexer = new HelloLexer(chars);
const tokens = new CommonTokenStream(lexer);
const parser = new HelloParser(tokens);
const tree = parser.r();

class MyTreeWalker extends HelloListener {

    exitMyStartRule = () => {
        console.log("In MyStartRule");
    };
    
}

const walker = new MyTreeWalker();
ParseTreeWalker.DEFAULT.walk(walker, tree);