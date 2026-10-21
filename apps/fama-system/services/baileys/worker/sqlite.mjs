export class DurableSqlite {
    constructor(sql){this.sql=sql;}
    exec(query){this.sql.exec(query);}
    prepare(query){
        return {
            get:(...values)=>this.sql.exec(query,...values).toArray()[0],
            all:(...values)=>this.sql.exec(query,...values).toArray(),
            run:(...values)=>{const result=this.sql.exec(query,...values);return {changes:result.rowsWritten};},
        };
    }
    close(){}
}
