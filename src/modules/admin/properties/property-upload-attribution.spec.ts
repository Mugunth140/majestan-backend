import {getMetadataArgsStorage} from 'typeorm';
import {Property} from '../../../database/entities/property.entity';
import {PropertyUploadAttribution1786600000000} from '../../../database/migrations/1786600000000-PropertyUploadAttribution';
it('keeps uploader identity private and nullable for legacy/public property reads',()=>{
 const column=getMetadataArgsStorage().columns.find(c=>c.target===Property&&c.propertyName==='uploadedByCrmUserId');
 expect(column?.options).toMatchObject({nullable:true,select:false,name:'uploaded_by_crm_user_id'});
});
it('adds uploader tracking and indexes without rewriting historical rows and tolerates reruns',async()=>{
 const query=jest.fn();
 const q:any={hasColumn:jest.fn(async()=>false),getTable:jest.fn(async()=>({indices:[]})),query};
 const migration=new PropertyUploadAttribution1786600000000();await migration.up(q);
 expect(query).toHaveBeenCalledTimes(3);
 expect(query.mock.calls.every(([sql])=>!/\b(UPDATE|DELETE|DROP)\b/i.test(sql))).toBe(true);
 q.hasColumn.mockResolvedValue(true);q.getTable.mockResolvedValue({indices:[{name:'idx_properties_uploaded_date'},{name:'idx_properties_upload_date'}]});query.mockClear();
 await migration.up(q);await migration.down();expect(query).not.toHaveBeenCalled();
});
