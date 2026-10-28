const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const root=path.resolve(__dirname,'../..');
const section=JSON.parse(fs.readFileSync(root+'/work/a02-corp/section-3.2.json','utf8'));const pages=[],rules=[],images=[];
function walk(n,ancestry=[]){const title=n.text.split('RQM_META')[0].replace(/\u2060/g,'').trim();const parents=[...ancestry,{number:n.number,title}];if(/【ZJJK|【场景/.test(title))pages.push({number:n.number,title,status:'待核验'});if(/【.*】.*规则/.test(title))rules.push({number:n.number,title,parents:ancestry,content:n.content,status:'待核验'});for(const c of n.content||[])if(c.type==='image')images.push({number:n.number,...c});for(const child of n.children||[])walk(child,parents);}
walk(section);const doc=fs.readFileSync(root+'/A02天阳信贷管理系统-客户管理需求分册【对公客户管理】.docx');
fs.writeFileSync(__dirname+'/requirements.json',JSON.stringify({source:'A02 §3.2',sourceSha256:crypto.createHash('sha256').update(doc).digest('hex'),pages,rules,images},null,2));
fs.writeFileSync(__dirname+'/coverage.md','# 对公客户管理需求覆盖台账\n\n本轮重新采集；待核验项不计为完成。\n\n| 章节 | 页面或场景 | 状态 |\n| --- | --- | --- |\n'+pages.map(x=>`| ${x.number} | ${x.title} | ${x.status} |`).join('\n')+'\n');
console.log(JSON.stringify({pages:pages.length,rules:rules.length,images:images.length}));
