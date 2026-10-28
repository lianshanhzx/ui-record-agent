// 领域模型：报文中的单个步骤节点（page / popup / ele）
export class StepNode {
  constructor(raw) {
    this.id = String(raw.propertiesID);
    this.pid = String(raw.propertiesPID);
    this.type = raw.type;
    this.name = raw.propertiesName || raw.realLabel || `节点${raw.propertiesID}`;
    this.realLabel = raw.realLabel || '';
    this.xpath = raw.elementType || '';
    this.action = raw.eventTypeValue || '';
    this.value = raw.objectValue || '';
    this.raw = raw;
  }

  static from(raw) {
    return new StepNode(raw);
  }
}
