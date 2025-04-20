import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings  # ✅ FIXED IMPORT
from langchain.chains import RetrievalQA
from langchain_community.document_loaders import JSONLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_groq import ChatGroq
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# import os
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"


# Load environment variables
load_dotenv()

# Define app lifespan to properly initialize resources
@asynccontextmanager
async def lifespan(app: FastAPI):
    global qa_chain

    # Load JSONL Data
    data_file = "Bigdata.jsonl"
    documents = []

    with open(data_file, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            try:
                doc = json.loads(line.strip())  # Parse JSON
                if "prompt" in doc and "completion" in doc:
                    content = f"Q: {doc['prompt']}\nA: {doc['completion']}"
                    documents.append(Document(page_content=content, metadata={}))
            except json.JSONDecodeError as e:
                print(f"Skipping invalid JSON line {i}: {e}")

    print(f"Total Documents Loaded: {len(documents)}")

    # ✅ FIXED: Using langchain_huggingface instead of deprecated version
    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # Text Splitting
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=64)
    split_docs = text_splitter.split_documents(documents)

    # Create FAISS Vector Store
    vectorstore = FAISS.from_documents(split_docs, embedding=embedding_model)

    # Initialize Groq LLM
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise ValueError("GROQ_API_KEY is missing from environment variables.")

    llm = ChatGroq(model_name="deepseek-r1-distill-llama-70b", api_key=groq_api_key)

    # RetrievalQA Chain
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 5})
    )

    yield  # Cleanup can be done here if needed

# Initialize FastAPI app
app = FastAPI(lifespan=lifespan)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define input model
class Query(BaseModel):
    question: str

# API endpoint to ask the chatbot
@app.post("/ask")
async def ask_chatbot(query: Query):
    try:
        response = qa_chain.run(query.question)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# uvicorn main:app --reload