import argparse, csv, json, re, shutil, subprocess, sys, uuid
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
MEDIA = ROOT / 'frontend' / 'public' / 'media'
DRAFT = ROOT / 'content' / 'catalog.draft.json'
NAMESPACE = uuid.UUID('bb9de5f2-a478-5f3e-8930-488ee5ed53b8')

def main():
    ap = argparse.ArgumentParser(description='Prepare reviewed-catalog draft media')
    ap.add_argument('folder', type=Path)
    args = ap.parse_args()
    source = args.folder.resolve(strict=True)
    ffmpeg, ffprobe = shutil.which('ffmpeg'), shutil.which('ffprobe')
    if not ffmpeg or not ffprobe: raise ValueError('Install FFmpeg including ffprobe and add both to PATH.')
    if DRAFT.exists(): raise ValueError('catalog.draft.json already exists; move it before running again.')
    with (source / 'sources.csv').open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        required = {'slug','title','audio','image','audio_source_url','audio_license','audio_attribution','image_source_url','image_license','image_attribution'}
        if not reader.fieldnames or not required.issubset(reader.fieldnames): raise ValueError('sources.csv is missing required columns')
        rows = list(reader)
    plans=[]; seen=set()
    for row in rows:
        slug=row['slug'].strip()
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',slug) or slug in seen: raise ValueError('Invalid or duplicate slug')
        seen.add(slug)
        if not row['title'].strip(): raise ValueError('Title is required')
        for kind in ['audio','image']:
            if not row[kind+'_license'].strip(): raise ValueError('Both licences are required')
            u=urlparse(row[kind+'_source_url'].strip())
            if u.scheme!='https' or not u.hostname or u.username or u.password: raise ValueError('Source URL must be HTTPS without credentials')
        files=[]
        for name in ['audio','image']:
            file=(source / row[name]).resolve(strict=True)
            if source not in file.parents or not file.is_file(): raise ValueError('Source file must be inside the selected folder')
            files.append(file)
        outaudio=MEDIA/'audio'/f'{slug}.mp3';outimage=MEDIA/'images'/f'{slug}.webp'
        if outaudio.exists() or outimage.exists(): raise ValueError('Output already exists; choose a new slug')
        plans.append((row,slug,files,outaudio,outimage))
    items=[]
    for row,slug,files,outaudio,outimage in plans:
        outaudio.parent.mkdir(parents=True,exist_ok=True);outimage.parent.mkdir(parents=True,exist_ok=True)
        subprocess.run([ffmpeg,'-v','error','-nostdin','-n','-i',str(files[0]),'-vn','-map_metadata','-1','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-codec:a','libmp3lame','-b:a','128k',str(outaudio)],check=True)
        subprocess.run([ffmpeg,'-v','error','-nostdin','-n','-i',str(files[1]),'-map_metadata','-1','-vf','scale=1200:1200:force_original_aspect_ratio=decrease','-c:v','libwebp','-q:v','75','-frames:v','1',str(outimage)],check=True)
        result=subprocess.run([ffprobe,'-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(outaudio)],check=True,capture_output=True,text=True)
        duration=round(float(result.stdout.strip()))
        def asset(kind,output,mime):
            label='image' if kind=='images' else 'audio'
            return {'id':str(uuid.uuid5(NAMESPACE,slug+':'+kind)),'path':'/media/'+kind+'/'+output.name,'mimeType':mime,'sourceUrl':row[label+'_source_url'].strip(),'license':row[label+'_license'].strip(),'attribution':row[label+'_attribution'].strip()}
        items.append({'id':str(uuid.uuid5(NAMESPACE,slug+':content')),'title':row['title'].strip(),'description':None,'type':'audio','language':'en','durationSeconds':duration,'needTags':[],'suitabilityTags':[],'status':'draft','reviewVersion':'review-required','audio':asset('audio',outaudio,'audio/mpeg'),'image':asset('images',outimage,'image/webp')})
        print(f'{slug}: audio {outaudio.stat().st_size} bytes, {duration}s; image {outimage.stat().st_size} bytes')
    DRAFT.parent.mkdir(parents=True,exist_ok=True);DRAFT.write_text(json.dumps({'version':1,'items':items},indent=2)+'\n',encoding='utf-8')
    print('Draft created at content/catalog.draft.json; review and copy to catalog.json before seeding.')
if __name__ == '__main__':
    try: main()
    except ValueError as exc:
        print(f'Media preparation failed: {exc}',file=sys.stderr);sys.exit(1)
    except (OSError,subprocess.SubprocessError):
        print('Media preparation failed: file or conversion error',file=sys.stderr);sys.exit(1)
