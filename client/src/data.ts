export type Role = 'student' | 'admin'

export interface Lesson {
  id: string
  title: string
  titleAr: string
  content: string
  contentAr: string
  duration: number
  completed?: boolean
}

export interface Course {
  id: string
  title: string
  titleAr: string
  category: string
  categoryAr: string
  instructor: string
  instructorAr: string
  description: string
  descriptionAr: string
  level: string
  image: string
  lessons: Lesson[]
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
}

export const categories = [
  { id: 'all', en: 'All subjects', ar: 'كل المجالات' },
  { id: 'design', en: 'Design', ar: 'التصميم' },
  { id: 'research', en: 'Research', ar: 'البحث' },
  { id: 'technology', en: 'Technology', ar: 'التقنية' },
  { id: 'humanities', en: 'Humanities', ar: 'العلوم الإنسانية' },
]

export const courses: Course[] = [
  {
    id: 'ux-foundations',
    title: 'Foundations of User Experience',
    titleAr: 'أساسيات تجربة المستخدم',
    category: 'Design',
    categoryAr: 'التصميم',
    instructor: 'Maya Chen',
    instructorAr: 'مايا تشين',
    description: 'Learn to understand people, frame problems, and design clear digital experiences through research and thoughtful iteration.',
    descriptionAr: 'تعلّم فهم احتياجات الناس وصياغة المشكلات وتصميم تجارب رقمية واضحة بالبحث والتطوير المدروس.',
    level: 'Beginner',
    image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1000&q=82',
    lessons: [
      { id: 'ux-1', title: 'Start with people', titleAr: 'ابدأ بالناس', duration: 12, content: 'Good design begins with curiosity about the people who will use a product. In this lesson, we distinguish assumptions from evidence and identify useful research questions. Notice how a small, open-ended conversation can reveal needs that a checklist might miss.', contentAr: 'يبدأ التصميم الجيد بالفضول تجاه الأشخاص الذين سيستخدمون المنتج. نميّز في هذا الدرس بين الافتراضات والأدلة ونحدّد أسئلة بحث مفيدة. لاحظ كيف يمكن لحوار بسيط ومفتوح أن يكشف احتياجات قد لا تظهر في قائمة أسئلة جاهزة.', completed: true },
      { id: 'ux-2', title: 'Map the journey', titleAr: 'ارسم رحلة المستخدم', duration: 16, content: 'A journey map makes a sequence of actions visible. Capture the user’s goal, key touchpoints, friction, and moments of confidence before proposing a solution. Keep the map grounded in real observations, not idealized assumptions.', contentAr: 'تُظهر خريطة الرحلة تسلسل الخطوات بوضوح. سجّل هدف المستخدم ونقاط التفاعل والعوائق ولحظات الثقة قبل اقتراح الحل. استند إلى الملاحظات الفعلية، لا إلى افتراضات مثالية.', completed: true },
      { id: 'ux-3', title: 'Prototype and learn', titleAr: 'أنشئ نموذجاً وتعلّم', duration: 18, content: 'A prototype is a question made tangible. Test one important assumption at a time, invite people to think aloud, and use what you learn to refine the next iteration. A useful test is less about proving an idea and more about discovering what you had not yet considered.', contentAr: 'النموذج الأولي سؤال قابل للتجربة. اختبر افتراضاً مهماً واحداً في كل مرة، واطلب من المشاركين التعبير عن تفكيرهم، ثم استخدم ما تعلّمته لتحسين النسخة التالية. لا يهدف الاختبار الجيد إلى إثبات الفكرة بقدر ما يساعدك على اكتشاف ما لم تفكر فيه بعد.' },
    ],
  },
  {
    id: 'public-writing',
    title: 'Writing for the Public Good',
    titleAr: 'الكتابة من أجل الصالح العام',
    category: 'Research',
    categoryAr: 'البحث',
    instructor: 'Samira Haddad',
    instructorAr: 'سميرة حداد',
    description: 'Build a practical toolkit for clear, compassionate writing in public-interest and community settings.',
    descriptionAr: 'ابنِ أدوات عملية للكتابة الواضحة والمتعاطفة في المبادرات العامة والمجتمعية.',
    level: 'Intermediate',
    image: 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1000&q=82',
    lessons: [
      { id: 'writing-1', title: 'Clarity as a public service', titleAr: 'الوضوح خدمة عامة', duration: 14, content: 'Readers bring different levels of knowledge and time. Put the main point first, choose familiar words, and explain what someone can do next. Clarity is an act of respect: it makes useful information easier to find and act on.', contentAr: 'يختلف القراء في معرفتهم ووقتهم. ابدأ بالفكرة الأساسية، واختر كلمات مألوفة، واشرح الخطوة التالية الممكنة. الوضوح شكل من أشكال الاحترام، فهو يجعل المعلومات المفيدة أسهل في الوصول والعمل بها.' },
      { id: 'writing-2', title: 'Structure for scanning', titleAr: 'نظّم النص لسهولة التصفّح', duration: 11, content: 'Descriptive headings, short sections, and meaningful lists help readers find what matters without oversimplifying the subject. Read only the headings: do they tell a coherent story on their own?', contentAr: 'تساعد العناوين الوصفية والفقرات القصيرة والقوائم الواضحة القراء على العثور على المعلومات المهمة دون تبسيط مخلّ. اقرأ العناوين وحدها: هل تحكي قصة مترابطة؟' },
      { id: 'writing-3', title: 'Edit with care', titleAr: 'حرّر بعناية', duration: 13, content: 'Read the draft aloud, check names and dates, and ask an unfamiliar reader where they hesitate. Revise for accuracy as well as ease. The most trustworthy copy is clear about both what is known and what remains uncertain.', contentAr: 'اقرأ المسودة بصوت مسموع، وتحقق من الأسماء والتواريخ، واسأل قارئاً غير مطّلع على الموضوع أين يتردد. راجع الدقة والوضوح معاً. النص الأكثر موثوقية يوضح ما نعرفه وما لا يزال غير مؤكّد.' },
    ],
  },
  {
    id: 'data-literacy',
    title: 'Data Literacy for Everyday Decisions',
    titleAr: 'الثقافة البيانية للقرارات اليومية',
    category: 'Technology',
    categoryAr: 'التقنية',
    instructor: 'Omar Rahman',
    instructorAr: 'عمر رحمن',
    description: 'Read charts with care, ask better questions of evidence, and communicate what data can—and cannot—tell us.',
    descriptionAr: 'اقرأ الرسوم البيانية بعناية، واطرح أسئلة أفضل حول الأدلة، واشرح ما يمكن للبيانات قوله وما لا يمكنها قوله.',
    level: 'Beginner',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1000&q=82',
    lessons: [
      { id: 'data-1', title: 'Ask before you count', titleAr: 'اسأل قبل أن تحصي', duration: 10, content: 'Begin with the decision you need to make. A precise question clarifies which observations matter and prevents a convenient metric from replacing the real goal. Good measurement starts with a human question, not a dashboard.', contentAr: 'ابدأ بالقرار الذي تحتاج إلى اتخاذه. يوضّح السؤال الدقيق الملاحظات المهمة ويمنع أن يحلّ مقياس سهل محل الهدف الحقيقي. يبدأ القياس الجيد بسؤال إنساني، لا بلوحة مؤشرات.' },
      { id: 'data-2', title: 'Read a chart honestly', titleAr: 'اقرأ الرسم البياني بإنصاف', duration: 15, content: 'Check the units, time period, source, and scale. Look for missing context before comparing values or drawing a conclusion from a visual pattern. A chart can be accurate and still leave out important information.', contentAr: 'تحقق من الوحدات والفترة الزمنية والمصدر والمقياس. ابحث عن السياق الناقص قبل مقارنة القيم أو استنتاج معنى من نمط مرئي. قد يكون الرسم البياني دقيقاً ومع ذلك يغفل معلومات مهمة.' },
      { id: 'data-3', title: 'Share uncertainty', titleAr: 'عبّر عن عدم اليقين', duration: 12, content: 'Responsible analysis separates what is observed from what is inferred. State limitations plainly and describe which new evidence would change your view. Trust grows when an analysis communicates its limits.', contentAr: 'يفصل التحليل المسؤول بين الملاحظة والاستنتاج. اذكر القيود بوضوح وبيّن الأدلة الجديدة التي قد تغيّر رأيك. تزداد الثقة حين يوضّح التحليل حدوده.' },
    ],
  },
  {
    id: 'community-history',
    title: 'Listening to Local Histories',
    titleAr: 'الإصغاء إلى التاريخ المحلي',
    category: 'Humanities',
    categoryAr: 'العلوم الإنسانية',
    instructor: 'Noura Al-Khatib',
    instructorAr: 'نورة الخطيب',
    description: 'Explore ethical oral-history practice and the small details that make community stories vivid.',
    descriptionAr: 'اكتشف أخلاقيات التاريخ الشفهي والتفاصيل الصغيرة التي تمنح قصص المجتمع حيويتها.',
    level: 'Beginner',
    image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1000&q=82',
    lessons: [
      { id: 'history-1', title: 'Prepare to listen', titleAr: 'استعد للإصغاء', duration: 12, content: 'A thoughtful conversation starts before the recorder is switched on. Learn how to ask for informed consent, create a comfortable setting, and invite a narrator to shape the conversation.', contentAr: 'تبدأ المحادثة الواعية قبل تشغيل جهاز التسجيل. تعلّم طلب الموافقة المستنيرة وتهيئة مكان مريح ودعوة الراوي للمشاركة في توجيه الحوار.' },
      { id: 'history-2', title: 'Ask open questions', titleAr: 'اطرح أسئلة مفتوحة', duration: 16, content: 'Open questions leave room for memory and meaning. Follow the narrator’s language, leave pauses, and ask about a detail that seems important to them.', contentAr: 'تترك الأسئلة المفتوحة مساحة للذاكرة والمعنى. تابع لغة الراوي واترك فواصل واطرح أسئلة عن التفاصيل التي تبدو مهمة له.' },
      { id: 'history-3', title: 'Care for the story', titleAr: 'صُن القصة', duration: 14, content: 'Careful stewardship includes accurate notes, agreed boundaries, and a clear conversation about how a story may be shared. The narrator’s trust remains part of the work.', contentAr: 'تشمل الرعاية الدقيقة ملاحظات صحيحة وحدوداً متفقاً عليها وحواراً واضحاً حول كيفية مشاركة القصة. تظل ثقة الراوي جزءاً من العمل.' },
    ],
  },
]
