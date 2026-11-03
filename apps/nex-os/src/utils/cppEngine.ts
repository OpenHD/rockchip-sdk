/**
 * Dev-C++ 2026 - Ultra-Performance C++ Simulation Engine
 * This version supports asynchronous IO (std::cin) and better multi-file handling.
 */

export interface CppProjectFile {
  name: string;
  content: string;
  language: string;
}

export interface IOBridge {
  cout: (val: string) => void;
  cin: () => Promise<string>;
}

export interface ExecutionResult {
  exitCode: number;
  errors: string[];
}

export class CppEngine {
  private files: Record<string, CppProjectFile>;
  private io: IOBridge;

  constructor(files: Record<string, CppProjectFile>, io: IOBridge) {
    this.files = files;
    this.io = io;
  }

  private preProcess(filename: string, visited: Set<string> = new Set()): string {
    const file = this.files[filename];
    if (!file || visited.has(filename)) return '';
    visited.add(filename);

    let processed = file.content;
    
    // Resolve local includes: #include "..."
    const includeRegex = /#include\s+"([^"]+)"/g;
    processed = processed.replace(includeRegex, (match, includedFilename) => {
      return `// Start of ${includedFilename}\n${this.preProcess(includedFilename, visited)}\n// End of ${includedFilename}`;
    });

    return processed;
  }

  /**
   * Main execution loop - now async to support 'await this.io.cin()'
   */
  public async execute(mainFile: string = 'main.cpp'): Promise<ExecutionResult> {
    const errors: string[] = [];
    
    try {
      const code = this.preProcess(mainFile);
      
      if (!code.includes('main')) {
        errors.push("error: 'main' was not declared in this scope");
        return { exitCode: 1, errors };
      }

      // 1. Transpilation logic
      let jsCode = code;

      // Strip preprocessor
      jsCode = jsCode.replace(/#include\b.*/g, '');
      jsCode = jsCode.replace(/using namespace std;/g, '');

      // Transform cout << ... << endl;
      const coutRegex = /cout\s*<<\s*([^;]+);/g;
      jsCode = jsCode.replace(coutRegex, (match, content) => {
        const parts = content.split('<<').map((p: string) => p.trim());
        const jsParts = parts.map((p: string) => {
          if (p === 'endl' || p === '"\\n"') return '"\\n"';
          return p;
        });
        return `await __io.cout(${jsParts.join(' + ')});`;
      });

      // Transform cin >> var;
      const cinRegex = /cin\s*>>\s*([a-zA-Z_]\w*)\s*;/g;
      jsCode = jsCode.replace(cinRegex, (match, varName) => {
        return `${varName} = await __io.cin();`;
      });

      // Transform types to var/let
      jsCode = jsCode.replace(/\b(int|float|double|char|auto|string|vector<[^>]+>)\s+([a-zA-Z_]\w*)/g, 'let $2');
      
      // Transform loops
      jsCode = jsCode.replace(/for\s*\(\s*(int|var|let)\s+/g, 'for(let ');

      // Wrap main
      jsCode = jsCode.replace(/int main\s*\([\s\S]*?\)\s*\{/, 'async function main() {');

      const finalCode = `
        const __io = {
          cout: async (val) => { 
            const str = val === undefined ? '' : val.toString();
            await context.io.cout(str);
          },
          cin: async () => {
            return await context.io.cin();
          }
        };
        
        ${jsCode}
        
        try {
          if (typeof main === 'function') {
            await main();
          } else {
             // If we couldn't find/replace 'main' correctly, try to just run the code
             // This handles cases where main might be weirdly formatted
          }
        } catch (e) {
          throw e;
        }
      `;

      // Execution context
      const context = {
        io: this.io
      };

      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const runner = new AsyncFunction('context', finalCode);
      
      await runner(context);

    } catch (err: any) {
      errors.push(`Runtime error: ${err.message}`);
    }

    return {
      exitCode: errors.length > 0 ? 1 : 0,
      errors
    };
  }
}
