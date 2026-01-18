from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class BenchmarkType(str, Enum):
    BTC_USD = "BTC-USD"
    SP500 = "S&P 500"
    CSI300 = "CSI 300"
    ETH_USD = "ETH-USD"
    CUSTOM_A = "CUSTOM_A"


class Source(BaseModel):
    title: str
    url: str


class AuthProvider(str, Enum):
    GOOGLE = "google"
    GITHUB = "github"


class User(BaseModel):
    id: str
    name: str
    email: str
    avatar: str
    provider: AuthProvider
    isLoggedIn: bool


class AlphaFactor(BaseModel):
    id: str
    userId: Optional[str] = None
    name: str
    formula: str
    description: str
    intuition: str
    category: str
    createdAt: int
    sources: Optional[List[Source]] = None
    lastBenchmark: Optional[BenchmarkType] = None
    buyThreshold: Optional[str] = None
    sellThreshold: Optional[str] = None
    pythonCode: Optional[str] = None


class PricePoint(BaseModel):
    date: str
    close: float
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    volume: Optional[float] = None


class BacktestMetrics(BaseModel):
    sharpeRatio: float
    annualizedReturn: float
    maxDrawdown: float
    volatility: float
    winRate: float
    benchmarkName: str
    ic: Optional[float] = None


class BacktestDataPoint(BaseModel):
    date: str
    strategyReturn: float
    benchmarkReturn: float
    cumulativeStrategy: float
    cumulativeBenchmark: float
    signal: Optional[str] = None


class Trade(BaseModel):
    date: str
    type: str
    price: float
    quantity: float
    amount: float


class BacktestResult(BaseModel):
    data: List[BacktestDataPoint]
    metrics: BacktestMetrics
    trades: List[Trade]
    pythonCode: Optional[str] = None


class GenerationConfig(BaseModel):
    investmentUniverse: str
    timeHorizon: str
    riskTolerance: str
    targetMetrics: List[str]


class BacktestRequest(BaseModel):
    formula: str
    benchmark: BenchmarkType
    buyThreshold: Optional[str] = None
    sellThreshold: Optional[str] = None
    pythonCode: Optional[str] = None
    customCode: Optional[str] = None


class GenerateRequest(BaseModel):
    prompt: str
    config: GenerationConfig


class GenerateBulkRequest(BaseModel):
    count: int
    config: GenerationConfig


class SaveUserRequest(BaseModel):
    user: User


class SyncFactorsRequest(BaseModel):
    userId: str
    factors: List[AlphaFactor]


class SaveFactorRequest(BaseModel):
    userId: str
    factor: AlphaFactor


class DeleteFactorRequest(BaseModel):
    userId: str


class SaveBacktestResultRequest(BaseModel):
    userId: str
    factorId: str
    result: BacktestResult


class GithubAuthExchangeRequest(BaseModel):
    code: str
    redirectUri: str
