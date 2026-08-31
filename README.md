# HDB Resale Insight

基于历史交易数据的「新加坡 HDB 转售房价智能估价与趋势分析系统」。以 CatBoost 估算相似房屋的合理转售价区间，并提供 Town × Flat Type 历史走势、未来 12 个月统计趋势与近期真实成交参考。

> 结果不是对某一具体单元未来成交价的保证，也不构成投资建议。

## Demo 与截图

- 前端 Demo：<https://hdb-resale-insight.equal-cove-8327.chatgpt.site>
- 站点预览图：[`web/public/og.png`](web/public/og.png)

已发布前端的真实估价需要配置一个可公网访问的 FastAPI 地址。仓库和本地联调已完成；未配置时，线上页面会明确报出服务不可用，不会使用公式或随机数伪装预测。

## 核心功能

- 输入 Town、户型、面积、楼层范围、房屋模型与租约起始年进行估价。
- FastAPI 调用已训练 CatBoost，返回中位价、下界、上界和 SGD 币种。
- Town × Flat Type 的历史单价、未来 12 个月趋势、近期真实成交和地区单价对比。
- 展示 R²、MAE、MAPE、价格区间覆盖率及适用边界。

## 技术栈

Python、pandas、NumPy、CatBoost、FastAPI、Pydantic、Uvicorn、pytest；前端使用 React、TypeScript、Vinext、Tailwind CSS、shadcn/ui 与 Recharts。

## 数据来源与规模

数据来自 [data.gov.sg 的 HDB 转售登记公开数据](https://data.gov.sg/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc/view)。下载版本覆盖 2017-01 至 2026-08，共 **239,330** 条、11 个字段。2026-08 是下载时未完整月份，训练与评估时排除；清洗后参与切分的数据为 236,945 条。

完整 CSV 不提交 Git；下载方式与五行示例见 [`data/README.md`](data/README.md)。

## 数据处理与特征工程

1. 校验官方字段，解析月份、面积、租约与价格，移除缺失及明显异常记录。
2. 从 `remaining_lease` 解析剩余租约月数；从楼层范围构造中位楼层。
3. 构造交易年、月、房龄；价格采用 `log1p(resale_price)` 建模。
4. 模型特征为 Town、户型、楼层范围、面积、房屋模型、租约起始年、剩余租约月数、交易年/月、楼层中位值和房龄。

Town、户型、楼层范围与房屋模型作为类别特征输入 CatBoost。

## 为什么选择 CatBoost

HDB 数据同时有数值变量和类别变量。CatBoost 可原生处理类别特征，避免高维 one-hot 编码，并能学习非线性关系和特征交互。它不是被宣称为“唯一最佳”模型；选择依据是本项目时间外测试与可复现流程。

## 训练方法与时间切分

模型是 CatBoostRegressor：900 iterations、depth 8、learning rate 0.06、L2 regularization 5、随机种子 42。按月份严格切分，避免未来信息泄漏：

| 数据集 | 月份 | 行数 |
| --- | --- | ---: |
| Train | 截至 2025-10 | 218,384 |
| Calibration | 2025-11 至 2026-01 | 6,021 |
| Test | 2026-02 至 2026-07 | 12,540 |

## 模型评估与区间预测

在最近 6 个月时间留出测试集上，模型 **R² 达到 0.9523，MAPE 约为 4.95%**。R² 不是“准确率”。

| 指标 | 实际结果 |
| --- | ---: |
| R² | 0.9523 |
| MAE | S$32,980 |
| RMSE | S$47,041 |
| MAPE | 4.95% |
| 名义区间覆盖率 | 80% |
| 实际区间覆盖率 | 77.6% |

区间通过独立校准集的对数价格残差构造 conformal prediction 半径，再转换回 SGD。实际覆盖率为 77.6%，因此项目不会把它写成虚假的 80%。指标原值见 [`artifacts/metrics.json`](artifacts/metrics.json)。

## 系统架构

```text
浏览器前端 (web) → POST /predict → FastAPI (app/backend)
                                      ↓
                         CatBoost 模型 + 校准半径
                                      ↓
             predicted_price / lower_bound / upper_bound / currency
```

趋势图采用独立的月度统计趋势方法，不等同于逐套房屋的 CatBoost 估价模型。

## API

`GET /health`

```json
{"status":"ok","model_loaded":true}
```

`POST /predict`

```json
{
  "town": "TAMPINES",
  "flat_type": "4 ROOM",
  "floor_area_sqm": 93,
  "storey_range": "07 TO 09",
  "flat_model": "Model A",
  "lease_commence_date": 1995
}
```

本地真实模型返回示例：

```json
{"predicted_price":653131.22,"lower_bound":606999.35,"upper_bound":702769.1,"currency":"SGD"}
```

输入会校验 Town、户型、面积、楼层格式和租约年份。模型不可用时，`/health` 报告未加载，`/predict` 返回 503。

## 本地运行

要求 Python 3.11+、Node.js 20+。

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m scripts.download_data
python -m scripts.train_price_model
uvicorn app.backend.main:app --reload --port 8000
```

另开终端运行前端：

```powershell
cd web
copy .env.example .env.local
npm install
npm run dev
```

默认前端调用 `http://localhost:8000`，API 文档位于 `http://127.0.0.1:8000/docs`。部署时应把 `NEXT_PUBLIC_HDB_API_URL` 设为公网 API 地址，并将前端域名加入 `HDB_ALLOWED_ORIGINS`。

## GitHub 克隆与发布建议

```powershell
git clone <your-repository-url>
cd hdb-resale-insight
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m scripts.download_data
python -m scripts.train_price_model
```

模型文件约 4.56 MB，低于 GitHub 100 MB 单文件限制，可以直接提交，不需要 Git LFS。若以后超过限制，应改用 GitHub Release 或模型下载脚本。

## 测试

```powershell
python -m pytest -q
```

覆盖数据处理、时间切分、特征/指标函数、保存模型推理、API 健康检查与输入校验。

## 限制与后续优化

- 官方数据没有单元号、装修、朝向、景观、楼栋微观位置和买卖双方条件；结果仅反映历史相似交易下的合理范围。
- 当前模型以 2026-07 为推理参考月，需随新成交数据定期重训。
- 趋势预测是聚合统计，不应承诺投资收益。
- 可继续加入地理位置、交通/学校可达性、模型漂移监控、Town 分组误差分析、独立公网后端和端到端监控。
