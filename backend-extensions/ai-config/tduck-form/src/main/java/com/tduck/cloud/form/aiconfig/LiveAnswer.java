package com.tduck.cloud.form.aiconfig;

import java.util.function.*;
import java.util.*;

/** Request-thread binding. Only projected public answer text is emitted, never reasoning/tool JSON. */
public final class LiveAnswer {
    private static final ThreadLocal<BiConsumer<String,String>> SINK=new ThreadLocal<>();
    private static final ThreadLocal<String> FIELD=new ThreadLocal<>();
    public static void bind(BiConsumer<String,String> sink){SINK.set(sink);}
    public static void clear(){SINK.remove();FIELD.remove();}
    public static boolean active(){return SINK.get()!=null&&FIELD.get()!=null;}
    public static String generate(String field,Supplier<String> call){String prior=FIELD.get();FIELD.set(field);try{return call.get();}finally{if(prior==null)FIELD.remove();else FIELD.set(prior);}}
    public static Consumer<String> projector(){BiConsumer<String,String> sink=SINK.get();sink.accept("draft_reset","");return new Projection(FIELD.get(),text->sink.accept("draft_delta",text));}
    public static final class Projection implements Consumer<String> {
        private final String field;private final Consumer<String> output;private final StringBuilder token=new StringBuilder(),unicode=new StringBuilder();
        private boolean quoted,escape,value,wanted;private String key="";private char high;
        public Projection(String field,Consumer<String> output){this.field=field;this.output=output;}
        private void emit(char c){if(high!=0){if(Character.isLowSurrogate(c)){output.accept(new String(new char[]{high,c}));high=0;return;}output.accept("\uFFFD");high=0;}if(Character.isHighSurrogate(c))high=c;else output.accept(String.valueOf(c));}
        public void accept(String chunk){for(char c:chunk.toCharArray()){
            if(!quoted){if(c=='"'){quoted=true;wanted=value&&field.equals(key);token.setLength(0);value=false;}else if(c==':'){value=true;key=token.toString();}else if(!Character.isWhitespace(c))value=false;continue;}
            if(unicode.length()>0){unicode.append(c);if(unicode.length()==5){char decoded=(char)Integer.parseInt(unicode.substring(1),16);if(wanted)emit(decoded);else token.append(decoded);unicode.setLength(0);}continue;}
            if(escape){escape=false;if(c=='u'){unicode.append('u');continue;}char decoded=c=='n'?'\n':c=='r'?'\r':c=='t'?'\t':c=='b'?'\b':c=='f'?'\f':c;if(wanted)emit(decoded);else token.append(decoded);continue;}
            if(c=='\\'){escape=true;continue;}if(c=='"'){quoted=false;if(wanted&&"text".equals(field))output.accept("\n\n");wanted=false;continue;}if(wanted)emit(c);else token.append(c);
        }}
    }
}
