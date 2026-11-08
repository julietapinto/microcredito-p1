export interface RawDocument {
  documento: string;   
  contenido: string;   
}

export interface Chunk {
  id: string;              
  documento: string;      
  seccion: string;         
  chunkIndex: number;      
  texto: string;
}

export interface EmbeddedChunk extends Chunk {
  embedding: number[];     
}

export interface RetrievedChunk extends Chunk {
  score: number;           
}

export interface Citation {
  documento: string;
  seccion: string;
  chunkId: string;
  fragmento: string;       
}