import {test} from '@playwright/test';
import * as list from '../../work/corp-rating-full-20261019/flows-list-apply.mjs';
import * as metrics from '../../work/corp-rating-full-20261019/flows-basic-metrics.mjs';
import * as conclusion from '../../work/corp-rating-full-20261019/flows-conclusion.mjs';
import * as credit from '../../work/corp-rating-full-20261019/flows-credit.mjs';
import * as images from '../../work/corp-rating-full-20261019/flows-images-risk.mjs';
import * as workflow from '../../work/corp-rating-full-20261019/flows-workflow.mjs';
import * as rerate from '../../work/corp-rating-full-20261019/flows-rerate.mjs';
import * as reports from '../../work/corp-rating-full-20261019/flows-report-retry.mjs';
import * as results from '../../work/corp-rating-full-20261019/flows-results.mjs';
import * as branches from '../../work/corp-rating-full-20261019/flows-branches.mjs';
for(const [name,flow]of Object.entries({
 'P01 M01-01 列表展示':list.list,'P01 M01-02 查询客户引入':list.customerQuery,'P01 M01-03 更多条件':list.more,'P01 M01-04 全字段查询':list.allQuery,'P01 M01-05 查询重置':list.reset,
 'P02 M02-01 向导控制':list.wizard,'P02 M02-02 客户选择':list.customerApply,'P02 M02-03 模型匹配':list.model,'P02 M02-04 准入校验':list.admission,'P02 M02-05 创建评级':list.apply,
 'P03 M01-06 修改':list.modify,'P03 M01-08 详情':list.detail,
 'P03 M03-01 基本信息':metrics.basic,'P03 M03-02 客户360':metrics.customer360,'P03 M03-03 步骤导航':metrics.navigation,
 'P04 M05-01 指标加载':metrics.metricLoad,'P04 M05-02 指标录入':metrics.metricEntry,'P04 M05-03 模型检查':metrics.modelVersion,'P04 M05-05 测算校验':metrics.metricValidation,'P04 M05-04 指标暂存':metrics.metricTemp,'P04 M05-06 评分测算':metrics.metricCalculate,
 'P05 M06-01 结论回显':conclusion.conclusionLoad,'P05 M06-02 等级理由联动':conclusion.conclusionLink,'P05 M06-03 结论校验':conclusion.conclusionValidate,'P05 M06-04 结论保存':conclusion.conclusionSave,
 'P05 M07-01 实控人股东':conclusion.controllers,'P05 M07-02 评价录入':conclusion.evaluationEntry,'P05 M07-03 评价保存':conclusion.evaluationSave,
 'P06 M04-01 征信列表':credit.list,'P06 M04-02 一键添加':credit.oneKey,'P06 M04-04 授权日期':credit.dates,'P06 M04-03 手工新增':credit.add,'P06 M04-05 授权书入口':credit.authorizationForm,'P06 M04-06 授权保存校验':credit.authorizationValidate,'P06 M04-07 获取报告校验':credit.reportGetGuard,'P06 M04-10 查看报告校验':credit.reportViewGuard,'P06 M04-11 删除征信对象':credit.remove,
 'P07 M08-01 影像目录':images.imageList,'P07 M08-02 影像上传':images.imageUpload,'P07 M08-03 影像预览':images.imageView,'P07 M08-04 影像删除':images.imageDelete,
 'P08 M09-01 发起风控':images.riskStart,'P08 M09-02 风控结果':images.riskResult,'P08 M09-03 风控重试':images.riskRetry,
 'P03A M10-04 提交完整性校验':workflow.incompleteSubmission,
 'P09 M12-01 历年评级':workflow.history,'P09 M12-02 流程轨迹':workflow.track,'P09 M12-03 跟踪状态耗时':workflow.trackTimes,
 'P10 PROBE-submit 提交探路':workflow.submissionProbe,'P10 PROBE-tasks 待办探路':workflow.tasksProbe,
 'P11 M13-01 重评资格':rerate.eligibility,'P11 M13-02 重评向导':rerate.guide,'P11 M13-03 重评模型':rerate.model,'P11 M13-04 创建重评':rerate.create,'P11 M01-07 删除本轮草稿':rerate.remove,
 'P11 M04-08 报告重新获取及复用核对':reports.retry,
 'P12 M10-03 提交选当前账号':workflow.submit,'P12 M10-01 审查任务页面':workflow.reviewTask,'P12 M10-02 审查材料':workflow.reviewMaterials,'P12 PROBE-approval 审批探路':workflow.approvalProbe,
 'P13 M10-03 最终同意审批':workflow.approve,'P13 M11-01 结果生效':results.effective,'P13 M11-02 到期日计算':results.expiry,'P13 M11-03 法人隔离':results.tenant,
 'P14 BR-RETURN 退回':branches.returned,'P14 BR-DENY 不同意':branches.denied,'P14 BR-REVOKE 撤销':branches.revoked
}))test(name,async({page})=>{await flow(page);});
